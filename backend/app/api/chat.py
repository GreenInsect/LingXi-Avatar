"""
对话交互 API - 使用 LangGraph + Qwen 智能体
支持：文本对话、图片理解（Qwen-VL）、语音合成
"""
import asyncio
import base64
import importlib.util
import json
import re
import time
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import brief_text, elapsed_ms, get_logger, get_request_id
from app.models.database import get_db, SessionLocal, Conversation, AvatarConfig
from app.agent import run_agent
from app.services.tts_service import synthesize_speech

router = APIRouter()
logger = get_logger(__name__)


def _sse(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


# ── 请求/响应模型 ──────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    visitor_id: Optional[str] = None
    input_type: str = "text"          # text / voice
    location: Optional[str] = None
    interests: Optional[str] = None
    with_audio: bool = True
    image_base64: Optional[str] = None   # base64 图片（前端直接传）
    image_mime_type: Optional[str] = "image/jpeg"


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    avatar_emotion: str
    audio_base64: Optional[str] = None
    audio_duration: Optional[float] = None
    visitor_emotion: dict = {}
    knowledge_used: bool = False
    intent: str = "qa"
    agent_steps: list = []
    mouth_shapes: list = []
    timestamp: str


@router.post("/message/stream")
async def stream_message(request: ChatRequest):
    """发送消息，使用 SSE 流式返回 LangGraph 智能体最终回复。"""
    session_id = request.session_id or str(uuid.uuid4())
    logger.info(
        "chat stream start session_id=%s with_audio=%s has_image=%s message=%s",
        session_id,
        request.with_audio,
        bool(request.image_base64),
        brief_text(request.message, 180),
    )

    async def event_generator():
        queue: asyncio.Queue[tuple[str, str] | None] = asyncio.Queue()

        async def on_token(token: str):
            await queue.put(("token", token))

        async def run_and_finalize():
            try:
                history, avatar_dict, avatar_config_db = await _load_chat_context(session_id)
                result = await run_agent(
                    user_input=request.message,
                    session_id=session_id,
                    history=history,
                    image_base64=request.image_base64,
                    image_mime_type=request.image_mime_type,
                    location=request.location,
                    interests=request.interests,
                    avatar_config=avatar_dict,
                    stream_callback=on_token,
                )

                audio_base64, audio_duration, mouth_shapes = await _build_audio_and_mouth_shapes(
                    request=request,
                    reply=result["reply"],
                    avatar_emotion=result["avatar_emotion"],
                    avatar_config_db=avatar_config_db,
                    agent_steps=result.get("agent_steps", []),
                )
                _save_conversation(session_id, request, result)
                logger.info(
                    "chat stream done session_id=%s intent=%s reply_chars=%s has_audio=%s mouth_shapes=%s",
                    session_id,
                    result.get("intent"),
                    len(result.get("reply", "")),
                    bool(audio_base64),
                    len(mouth_shapes),
                )
                await queue.put(("event", _sse("done", {
                    "session_id": session_id,
                    "reply": result["reply"],
                    "avatar_emotion": result["avatar_emotion"],
                    "audio_base64": audio_base64,
                    "audio_duration": audio_duration,
                    "visitor_emotion": result.get("visitor_emotion", {}),
                    "knowledge_used": result.get("knowledge_used", False),
                    "intent": result.get("intent", "qa"),
                    "agent_steps": result.get("agent_steps", []),
                    "mouth_shapes": mouth_shapes,
                    "timestamp": datetime.utcnow().isoformat(),
                })))
            except Exception as e:
                logger.exception("chat stream failed session_id=%s", session_id)
                await queue.put(("event", _sse("error", {"message": str(e)})))
            finally:
                await queue.put(None)

        task = asyncio.create_task(run_and_finalize())
        yield _sse("session", {"session_id": session_id})

        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                kind, payload = item
                if kind == "event":
                    yield payload
                else:
                    yield _sse("token", {"content": payload})
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _load_chat_context(session_id: str):
    start = time.perf_counter()
    logger.info("chat context load start session_id=%s", session_id)
    db = SessionLocal()
    try:
        history_records = db.query(Conversation).filter(
            Conversation.session_id == session_id
        ).order_by(Conversation.created_at.desc()).limit(20).all()
        history = [
            {"role": r.role, "content": r.content}
            for r in reversed(history_records)
        ]

        avatar_config_db = db.query(AvatarConfig).filter(AvatarConfig.is_active == True).first()
        avatar_dict = None
        if avatar_config_db:
            avatar_dict = {
                "name": avatar_config_db.name,
                "personality": avatar_config_db.personality,
                "voice_id": avatar_config_db.voice_id,
            }
        logger.info(
            "chat context load done session_id=%s history_count=%s avatar_active=%s duration_ms=%s",
            session_id,
            len(history),
            bool(avatar_dict),
            elapsed_ms(start),
        )
        return history, avatar_dict, avatar_config_db
    except Exception:
        logger.exception(
            "chat context load failed session_id=%s duration_ms=%s",
            session_id,
            elapsed_ms(start),
        )
        raise
    finally:
        db.close()


def _save_conversation(session_id: str, request: ChatRequest, agent_result: dict):
    start = time.perf_counter()
    logger.info("chat conversation save start session_id=%s", session_id)
    db = SessionLocal()
    try:
        visitor_emotion = agent_result.get("visitor_emotion", {})
        db.add(Conversation(
            session_id=session_id,
            visitor_id=request.visitor_id,
            role="user",
            content=request.message,
            input_type=request.input_type,
            emotion=visitor_emotion.get("emotion"),
            sentiment_score=visitor_emotion.get("sentiment_score"),
            location=request.location,
            created_at=datetime.utcnow(),
        ))
        db.add(Conversation(
            session_id=session_id,
            visitor_id=request.visitor_id,
            role="assistant",
            content=agent_result["reply"],
            emotion=agent_result["avatar_emotion"],
            created_at=datetime.utcnow(),
        ))
        db.commit()
        logger.info(
            "chat conversation save done session_id=%s duration_ms=%s",
            session_id,
            elapsed_ms(start),
        )
    except Exception:
        db.rollback()
        logger.exception(
            "chat conversation save failed session_id=%s duration_ms=%s",
            session_id,
            elapsed_ms(start),
        )
        raise
    finally:
        db.close()


def _avatar_to_dict(avatar_config_db: AvatarConfig | None) -> dict | None:
    if not avatar_config_db:
        return None
    return {
        "name": avatar_config_db.name,
        "personality": avatar_config_db.personality,
        "voice_id": avatar_config_db.voice_id,
    }


async def _build_audio_and_mouth_shapes(
    request: ChatRequest,
    reply: str,
    avatar_emotion: str,
    avatar_config_db: AvatarConfig | None,
    agent_steps: list | None = None,
) -> tuple[Optional[str], Optional[float], list]:
    audio_base64 = None
    audio_duration = None
    mouth_shapes = []

    if not request.with_audio:
        logger.info("chat tts skipped reason=with_audio_false")
        return audio_base64, audio_duration, mouth_shapes
    if request.image_base64:
        logger.info("chat tts skipped reason=image_message")
        return audio_base64, audio_duration, mouth_shapes
    if settings.SKIP_TTS_ON_AGENT_FALLBACK and any("兜底" in str(step) or "技术问题" in str(step) for step in (agent_steps or [])):
        logger.warning("chat tts skipped reason=agent_fallback")
        return audio_base64, audio_duration, mouth_shapes

    tts_text = re.sub(r"\s*\[(\w+)\]\s*", "", reply).strip()
    if not tts_text:
        logger.warning("chat tts skipped reason=empty_tts_text")
        return audio_base64, audio_duration, mouth_shapes

    voice_id = avatar_config_db.voice_id if avatar_config_db else "Cherry"
    tts_start = time.perf_counter()
    logger.info(
        "chat tts stage start voice_id=%s emotion=%s text_chars=%s text=%s",
        voice_id,
        avatar_emotion,
        len(tts_text),
        brief_text(tts_text, 160),
    )
    tts_result = await synthesize_speech(
        text=tts_text,
        voice_id=voice_id,
        emotion=avatar_emotion,
    )
    audio_base64 = tts_result.get("audio_base64")
    audio_duration = tts_result.get("duration")
    audio_data = tts_result.get("audio_data")
    logger.info(
        "chat tts stage done has_audio=%s audio_duration=%s audio_bytes=%s duration_ms=%s",
        bool(audio_base64),
        audio_duration,
        len(audio_data) if audio_data else 0,
        elapsed_ms(tts_start),
    )

    mouth_start = time.perf_counter()
    logger.info(
        "chat mouth stage start has_audio_data=%s timeout_seconds=%s",
        bool(audio_data),
        settings.MOUTH_ANALYSIS_TIMEOUT_SECONDS,
    )
    if audio_data:
        try:
            missing_deps = [
                name for name in ("librosa", "onnxruntime")
                if importlib.util.find_spec(name) is None
            ]
            if missing_deps:
                logger.warning(
                    "chat mouth ml skipped missing_dependencies=%s fallback=rule",
                    ",".join(missing_deps),
                )
                from app.services.mouth_shape import analyze_mouth_shapes
                mouth_shapes = analyze_mouth_shapes(tts_text)
                logger.info(
                    "chat mouth rule done frames=%s duration_ms=%s",
                    len(mouth_shapes),
                    elapsed_ms(mouth_start),
                )
                return audio_base64, audio_duration, mouth_shapes

            from app.services.mouth_ml import analyze_mouth_shapes_ml
            mouth_shapes = await asyncio.wait_for(
                asyncio.to_thread(analyze_mouth_shapes_ml, audio_data),
                timeout=settings.MOUTH_ANALYSIS_TIMEOUT_SECONDS,
            )
            if not mouth_shapes:
                logger.warning(
                    "chat mouth ml unavailable, fallback rule reason=empty_result duration_ms=%s",
                    elapsed_ms(mouth_start),
                )
                from app.services.mouth_shape import analyze_mouth_shapes
                mouth_shapes = analyze_mouth_shapes(tts_text)
                logger.info(
                    "chat mouth rule done frames=%s duration_ms=%s",
                    len(mouth_shapes),
                    elapsed_ms(mouth_start),
                )
                return audio_base64, audio_duration, mouth_shapes
            logger.info(
                "chat mouth ml done frames=%s duration_ms=%s",
                len(mouth_shapes),
                elapsed_ms(mouth_start),
            )
        except Exception as e:
            logger.warning(
                "chat mouth ml failed, fallback rule duration_ms=%s error=%s",
                elapsed_ms(mouth_start),
                e,
                exc_info=logger.isEnabledFor(10),
            )
            from app.services.mouth_shape import analyze_mouth_shapes
            mouth_shapes = analyze_mouth_shapes(tts_text)
            logger.info(
                "chat mouth rule done frames=%s duration_ms=%s",
                len(mouth_shapes),
                elapsed_ms(mouth_start),
            )
    else:
        from app.services.mouth_shape import analyze_mouth_shapes
        mouth_shapes = analyze_mouth_shapes(tts_text)
        logger.info(
            "chat mouth rule done reason=no_audio_data frames=%s duration_ms=%s",
            len(mouth_shapes),
            elapsed_ms(mouth_start),
        )

    return audio_base64, audio_duration, mouth_shapes


# ── 文本/图片对话（JSON 请求）──────────────────────────────────
@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest, db: Session = Depends(get_db)):
    """发送消息，获取 LangGraph 智能体回复（支持可选图片）"""

    request_start = time.perf_counter()
    session_id = request.session_id or str(uuid.uuid4())
    logger.info(
        "chat message start session_id=%s visitor_id=%s input_type=%s with_audio=%s has_image=%s location=%s interests=%s message=%s",
        session_id,
        request.visitor_id,
        request.input_type,
        request.with_audio,
        bool(request.image_base64),
        brief_text(request.location, 80),
        brief_text(request.interests, 120),
        brief_text(request.message, 180),
    )

    try:
        # 获取对话历史
        db_start = time.perf_counter()
        logger.info("chat db history load start session_id=%s", session_id)
        history_records = db.query(Conversation).filter(
            Conversation.session_id == session_id
        ).order_by(Conversation.created_at.desc()).limit(20).all()

        history = [
            {"role": r.role, "content": r.content}
            for r in reversed(history_records)
        ]

        # 获取激活的数字人配置
        avatar_config_db = db.query(AvatarConfig).filter(AvatarConfig.is_active == True).first()
        avatar_dict = _avatar_to_dict(avatar_config_db)
        logger.info(
            "chat db history load done session_id=%s history_count=%s avatar_active=%s voice_id=%s duration_ms=%s",
            session_id,
            len(history),
            bool(avatar_dict),
            avatar_config_db.voice_id if avatar_config_db else None,
            elapsed_ms(db_start),
        )

        # 调用 LangGraph 智能体
        agent_start = time.perf_counter()
        logger.info("chat agent stage start session_id=%s", session_id)
        agent_result = await run_agent(
            user_input=request.message,
            session_id=session_id,
            history=history,
            image_base64=request.image_base64,
            image_mime_type=request.image_mime_type,
            location=request.location,
            interests=request.interests,
            avatar_config=avatar_dict,
        )
        logger.info(
            "chat agent stage done session_id=%s intent=%s reply_chars=%s knowledge_used=%s steps=%s duration_ms=%s",
            session_id,
            agent_result.get("intent"),
            len(agent_result.get("reply", "")),
            agent_result.get("knowledge_used"),
            len(agent_result.get("agent_steps", [])),
            elapsed_ms(agent_start),
        )

        audio_base64, audio_duration, mouth_shapes = await _build_audio_and_mouth_shapes(
            request=request,
            reply=agent_result["reply"],
            avatar_emotion=agent_result["avatar_emotion"],
            avatar_config_db=avatar_config_db,
            agent_steps=agent_result.get("agent_steps", []),
        )

        # 持久化对话记录
        visitor_emotion = agent_result.get("visitor_emotion", {})
        save_start = time.perf_counter()
        logger.info("chat db save start session_id=%s", session_id)

        db.add(Conversation(
            session_id=session_id,
            visitor_id=request.visitor_id,
            role="user",
            content=request.message,
            input_type=request.input_type,
            emotion=visitor_emotion.get("emotion"),
            sentiment_score=visitor_emotion.get("sentiment_score"),
            location=request.location,
            created_at=datetime.utcnow(),
        ))
        db.add(Conversation(
            session_id=session_id,
            visitor_id=request.visitor_id,
            role="assistant",
            content=agent_result["reply"],
            emotion=agent_result["avatar_emotion"],
            created_at=datetime.utcnow(),
        ))
        db.commit()
        logger.info(
            "chat db save done session_id=%s duration_ms=%s",
            session_id,
            elapsed_ms(save_start),
        )

        response = ChatResponse(
            session_id=session_id,
            reply=agent_result["reply"],
            avatar_emotion=agent_result["avatar_emotion"],
            audio_base64=audio_base64,
            audio_duration=audio_duration,
            visitor_emotion=visitor_emotion,
            knowledge_used=agent_result.get("knowledge_used", False),
            intent=agent_result.get("intent", "qa"),
            agent_steps=agent_result.get("agent_steps", []),
            mouth_shapes=mouth_shapes,
            timestamp=datetime.utcnow().isoformat(),
        )
        logger.info(
            "chat message done session_id=%s request_id=%s reply_chars=%s has_audio=%s mouth_shapes=%s total_duration_ms=%s",
            session_id,
            get_request_id(),
            len(response.reply),
            bool(response.audio_base64),
            len(response.mouth_shapes),
            elapsed_ms(request_start),
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception(
            "chat message failed session_id=%s request_id=%s total_duration_ms=%s error=%s",
            session_id,
            get_request_id(),
            elapsed_ms(request_start),
            e,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "message": "聊天接口处理失败，请查看后端日志中的 request_id 定位原因",
                "request_id": get_request_id(),
                "session_id": session_id,
                "error": str(e)[:300],
            },
        ) from e


# ── 图片上传接口（multipart/form-data）─────────────────────────
@router.post("/image-message", response_model=ChatResponse)
async def send_image_message(
    message: str = Form(default="请帮我介绍图片中的景点"),
    session_id: Optional[str] = Form(default=None),
    location: Optional[str] = Form(default=None),
    interests: Optional[str] = Form(default=None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """上传图片 + 文字消息（multipart），调用 Qwen-VL 进行图像理解"""
    request_start = time.perf_counter()
    logger.info(
        "chat image-message start session_id=%s filename=%s content_type=%s location=%s interests=%s message=%s",
        session_id,
        image.filename,
        image.content_type,
        brief_text(location, 80),
        brief_text(interests, 120),
        brief_text(message, 180),
    )

    # 读取图片并转 base64
    image_bytes = await image.read()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    mime_type = image.content_type or "image/jpeg"

    sid = session_id or str(uuid.uuid4())
    history_records = db.query(Conversation).filter(
        Conversation.session_id == sid
    ).order_by(Conversation.created_at.desc()).limit(10).all()
    history = [{"role": r.role, "content": r.content} for r in reversed(history_records)]

    agent_result = await run_agent(
        user_input=message,
        session_id=sid,
        history=history,
        image_base64=image_b64,
        image_mime_type=mime_type,
        location=location,
        interests=interests,
    )

    db.add(Conversation(
        session_id=sid, role="user",
        content=f"[图片分析] {message}",
        input_type="image",
        created_at=datetime.utcnow(),
    ))
    db.add(Conversation(
        session_id=sid, role="assistant",
        content=agent_result["reply"],
        emotion=agent_result["avatar_emotion"],
        created_at=datetime.utcnow(),
    ))
    db.commit()
    logger.info(
        "chat image-message done session_id=%s image_bytes=%s reply_chars=%s duration_ms=%s",
        sid,
        len(image_bytes),
        len(agent_result.get("reply", "")),
        elapsed_ms(request_start),
    )

    return ChatResponse(
        session_id=sid,
        reply=agent_result["reply"],
        avatar_emotion=agent_result["avatar_emotion"],
        visitor_emotion={},
        knowledge_used=agent_result.get("knowledge_used", False),
        intent="image",
        agent_steps=agent_result.get("agent_steps", []),
        mouth_shapes=[],
        timestamp=datetime.utcnow().isoformat(),
    )


# ── 历史记录 ───────────────────────────────────────────────────
@router.get("/history/{session_id}")
async def get_history(session_id: str, db: Session = Depends(get_db)):
    start = time.perf_counter()
    logger.info("chat history start session_id=%s", session_id)
    records = db.query(Conversation).filter(
        Conversation.session_id == session_id
    ).order_by(Conversation.created_at.asc()).all()
    logger.info(
        "chat history done session_id=%s records=%s duration_ms=%s",
        session_id,
        len(records),
        elapsed_ms(start),
    )

    return {
        "session_id": session_id,
        "messages": [
            {
                "role": r.role,
                "content": r.content,
                "emotion": r.emotion,
                "created_at": r.created_at.isoformat(),
            }
            for r in records
        ],
    }


@router.post("/new-session")
async def new_session():
    session_id = str(uuid.uuid4())
    logger.info("chat new-session created session_id=%s", session_id)
    return {"session_id": session_id}
