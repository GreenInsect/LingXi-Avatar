"""
对话交互 API - 使用 LangGraph + Qwen 智能体
支持：文本对话、图片理解（Qwen-VL）、语音合成
"""
import base64
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db, Conversation, AvatarConfig
from app.agent import run_agent
from app.services.tts_service import synthesize_speech

router = APIRouter()


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
    timestamp: str


# ── 文本/图片对话（JSON 请求）──────────────────────────────────
@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest, db: Session = Depends(get_db)):
    """发送消息，获取 LangGraph 智能体回复（支持可选图片）"""

    session_id = request.session_id or str(uuid.uuid4())

    # 获取对话历史
    history_records = db.query(Conversation).filter(
        Conversation.session_id == session_id
    ).order_by(Conversation.created_at.desc()).limit(20).all()

    history = [
        {"role": r.role, "content": r.content}
        for r in reversed(history_records)
    ]

    # 获取激活的数字人配置
    avatar_config_db = db.query(AvatarConfig).filter(AvatarConfig.is_active == True).first()
    avatar_dict = None
    if avatar_config_db:
        avatar_dict = {
            "name": avatar_config_db.name,
            "personality": avatar_config_db.personality,
            "voice_id": avatar_config_db.voice_id,
        }

    # 调用 LangGraph 智能体
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

    # 语音合成
    audio_base64 = None
    audio_duration = None
    if request.with_audio and not request.image_base64:  # 图片分析不需要 TTS
        voice_id = avatar_config_db.voice_id if avatar_config_db else "Cherry"
        tts_result = await synthesize_speech(
            text=agent_result["reply"],
            voice_id=voice_id,
            emotion=agent_result["avatar_emotion"],
        )
        audio_base64 = tts_result.get("audio_base64")
        audio_duration = tts_result.get("duration")

    # 持久化对话记录
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

    return ChatResponse(
        session_id=session_id,
        reply=agent_result["reply"],
        avatar_emotion=agent_result["avatar_emotion"],
        audio_base64=audio_base64,
        audio_duration=audio_duration,
        visitor_emotion=visitor_emotion,
        knowledge_used=agent_result.get("knowledge_used", False),
        intent=agent_result.get("intent", "qa"),
        agent_steps=agent_result.get("agent_steps", []),
        timestamp=datetime.utcnow().isoformat(),
    )


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

    return ChatResponse(
        session_id=sid,
        reply=agent_result["reply"],
        avatar_emotion=agent_result["avatar_emotion"],
        visitor_emotion={},
        knowledge_used=agent_result.get("knowledge_used", False),
        intent="image",
        agent_steps=agent_result.get("agent_steps", []),
        timestamp=datetime.utcnow().isoformat(),
    )


# ── 历史记录 ───────────────────────────────────────────────────
@router.get("/history/{session_id}")
async def get_history(session_id: str, db: Session = Depends(get_db)):
    records = db.query(Conversation).filter(
        Conversation.session_id == session_id
    ).order_by(Conversation.created_at.asc()).all()

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
    return {"session_id": str(uuid.uuid4())}
