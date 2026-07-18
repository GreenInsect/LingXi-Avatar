"""
管理后台 API
"""
import os
import time
from datetime import datetime, timedelta
from hmac import compare_digest
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db, AvatarConfig, KnowledgeDoc
from app.agent.rag_service import rag_service
from app.agent.qwen_client import qwen_client
from app.services.tts_service import get_available_voices
from app.core.config import settings
from app.core.logging import brief_text, elapsed_ms, get_logger

router = APIRouter()
logger = get_logger(__name__)
security = HTTPBearer(auto_error=False)
JWT_ALGORITHM = "HS256"


class AdminLoginRequest(BaseModel):
    username: str
    password: str


def _admin_auth_error() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="管理员登录已失效或无权限",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _create_admin_token(username: str) -> tuple[str, datetime]:
    expires_at = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = jwt.encode(
        {
            "sub": username,
            "scope": "admin",
            "exp": expires_at,
        },
        settings.SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )
    return token, expires_at


async def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _admin_auth_error()
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
    except JWTError:
        raise _admin_auth_error()

    if payload.get("scope") != "admin" or payload.get("sub") != settings.ADMIN_USERNAME:
        raise _admin_auth_error()
    return payload


@router.post("/login")
async def admin_login(payload: AdminLoginRequest):
    username = (payload.username or "").strip()
    password = payload.password or ""
    if not (
        compare_digest(username, settings.ADMIN_USERNAME)
        and compare_digest(password, settings.ADMIN_PASSWORD)
    ):
        logger.warning("admin login failed username=%s", brief_text(username, 60))
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token, expires_at = _create_admin_token(username)
    logger.info("admin login success username=%s expires_at=%s", username, expires_at.isoformat())
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_at": expires_at.isoformat(),
        "username": username,
    }


# ── 系统健康检查 ───────────────────────────────────────────────
@router.get("/health")
async def system_health(_admin: dict = Depends(require_admin)):
    """检查 DashScope 服务 + RAG 可用性"""
    health = await qwen_client.health_check()
    rag_status = rag_service._initialized
    return {
        "vllm": health,
        "rag_initialized": rag_status,
        "models": {
            "chat":  settings.QWEN_MODEL,
            "vision": settings.QWEN_VL_MODEL,
            "embed":  settings.EMBEDDING_MODEL,
        },
    }


# ── 数字人配置 ─────────────────────────────────────────────────
AVATAR_PRESETS = {
    "lingxi": {
        "name": "Lingxi",
        "avatar_type": "lingxi",
        "voice_id": "Cherry",
        "personality": "温柔清晰、真诚可靠、文化感强，适合作为灵山胜境主数字导游，能够自然讲解景区文化、路线、门票和游览建议。",
        "greeting": "您好！我是灵山胜境数字导游 Lingxi，很高兴为您服务！请问您想了解什么？",
    },
    "yumi": {
        "name": "Yumi",
        "avatar_type": "yumi",
        "voice_id": "Cherry",
        "personality": "温柔明亮、亲和可靠、表达丰富，适合担任默认景区数字导游，回答清晰自然，并能主动照顾游客情绪。",
        "greeting": "您好！我是灵山胜境数字导游 Yumi，很高兴为您服务！请问您想了解什么？",
    },
    "strawberryBunny": {
        "name": "草莓兔兔",
        "avatar_type": "strawberryBunny",
        "voice_id": "Cherry",
        "personality": "甜美亲切、活泼可爱、语气柔和，适合亲子游客、轻松问答和温暖陪伴式讲解。",
        "greeting": "您好！我是灵山胜境数字导游草莓兔兔，今天想带您甜甜地逛一逛景区～",
    },
    "bingtang": {
        "name": "冰糖",
        "avatar_type": "bingtang",
        "voice_id": "Cherry",
        "personality": "干练自信、表达利落、镜头感强，适合进行重点景点讲解、活动主持和高信息密度问答。",
        "greeting": "您好！我是灵山胜境数字导游冰糖，接下来由我为您清晰介绍景区亮点。",
    },
    "ellen": {
        "name": "Ellen",
        "avatar_type": "ellen",
        "voice_id": "Cherry",
        "personality": "轻松俏皮、反应灵动、表达自然，适合年轻游客互动、趣味问答和轻快的景区介绍。",
        "greeting": "您好！我是灵山胜境数字导游 Ellen，想了解景点、路线还是门票信息呢？",
    },
    "rabbitHole": {
        "name": "Rabbit Hole",
        "avatar_type": "rabbitHole",
        "voice_id": "Cherry",
        "personality": "活泼调皮、戏剧感强、反应夸张，适合趣味活动、互动演出和更有记忆点的游客交流。",
        "greeting": "您好！我是 Rabbit Hole，今天带您用更有趣的方式认识灵山胜境！",
    },
    "fuxuan": {
        "name": "Fu Xuan",
        "avatar_type": "fuxuan",
        "voice_id": "Cherry",
        "personality": "沉稳理性、表达精准、节奏从容，适合文化历史讲解、路线规划和需要可信度的服务场景。",
        "greeting": "您好！我是灵山胜境数字导游 Fu Xuan，我会为您准确介绍景区文化与游览建议。",
    },
    "huohuo": {
        "name": "Huo Huo",
        "avatar_type": "huohuo",
        "voice_id": "Cherry",
        "personality": "温柔谨慎、真诚耐心、语气柔和，适合解答游客困惑、安抚情绪和陪伴式景区导览。",
        "greeting": "您好！我是灵山胜境数字导游 Huo Huo，我会耐心陪您了解景区信息。",
    },
}
DEFAULT_AVATAR = AVATAR_PRESETS["lingxi"]
LEGACY_AVATAR_TYPE_MAP = {
    "guide_female": "lingxi",
    "guide_male": "fuxuan",
    "ancient": "fuxuan",
    "modern": "bingtang",
}


def _avatar_payload(config: AvatarConfig) -> dict:
    return {
        "id": config.id,
        "name": config.name,
        "avatar_type": config.avatar_type,
        "voice_id": config.voice_id,
        "personality": config.personality,
        "greeting": config.greeting,
        "is_active": config.is_active,
        "created_at": config.created_at.isoformat() if config.created_at else None,
    }


def _legacy_target_type(config: AvatarConfig) -> str | None:
    name = (config.name or "").strip()
    greeting = config.greeting or ""
    if name == "小慧" or "小慧" in greeting:
        return "lingxi"
    return LEGACY_AVATAR_TYPE_MAP.get(config.avatar_type)


def _apply_preset(config: AvatarConfig, preset_key: str) -> None:
    preset = AVATAR_PRESETS[preset_key]
    config.name = preset["name"]
    config.avatar_type = preset["avatar_type"]
    config.voice_id = config.voice_id or preset["voice_id"]
    config.personality = preset["personality"]
    config.greeting = preset["greeting"]


def _model_dump(model: BaseModel) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _ensure_default_avatar(db: Session, avatars: list[AvatarConfig]) -> list[AvatarConfig]:
    if not avatars:
        default = AvatarConfig(**DEFAULT_AVATAR, is_active=True)
        db.add(default)
        db.commit()
        db.refresh(default)
        logger.info(
            "admin avatar default created name=%s avatar_type=%s",
            default.name,
            default.avatar_type,
        )
        return [default]

    migrated = False
    for avatar in avatars:
        target_type = _legacy_target_type(avatar)
        if not target_type:
            continue
        logger.info(
            "admin avatar migrate legacy id=%s old_name=%s old_type=%s target_type=%s",
            avatar.id,
            brief_text(avatar.name, 60),
            avatar.avatar_type,
            target_type,
        )
        _apply_preset(avatar, target_type)
        migrated = True

    if migrated and not any(a.is_active for a in avatars):
        default_avatar = next((a for a in avatars if a.avatar_type == DEFAULT_AVATAR["avatar_type"]), avatars[0])
        default_avatar.is_active = True
        logger.info(
            "admin avatar no active after migration, activate id=%s avatar_type=%s",
            default_avatar.id,
            default_avatar.avatar_type,
        )

    if migrated:
        db.commit()
        avatars = db.query(AvatarConfig).order_by(AvatarConfig.id.asc()).all()

    return avatars


class AvatarConfigCreate(BaseModel):
    name: str = DEFAULT_AVATAR["name"]
    avatar_type: str = DEFAULT_AVATAR["avatar_type"]
    voice_id: str = "Cherry"
    personality: str = DEFAULT_AVATAR["personality"]
    greeting: str = DEFAULT_AVATAR["greeting"]


@router.get("/avatar/list")
async def list_avatars(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    start = time.perf_counter()
    avatars = db.query(AvatarConfig).order_by(AvatarConfig.id.asc()).all()
    logger.info("admin avatar list start count=%s", len(avatars))
    avatars = _ensure_default_avatar(db, avatars)
    response = [_avatar_payload(a) for a in avatars]
    logger.info(
        "admin avatar list done count=%s active=%s duration_ms=%s",
        len(response),
        next((a["avatar_type"] for a in response if a["is_active"]), None),
        elapsed_ms(start),
    )
    return {"avatars": response}


@router.post("/avatar/create")
async def create_avatar(
    config: AvatarConfigCreate,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    payload = _model_dump(config)
    logger.info(
        "admin avatar create start name=%s avatar_type=%s voice_id=%s greeting=%s",
        payload["name"],
        payload["avatar_type"],
        payload["voice_id"],
        brief_text(payload["greeting"], 80),
    )
    avatar = AvatarConfig(**payload)
    db.add(avatar)
    db.commit()
    db.refresh(avatar)
    logger.info("admin avatar create done id=%s avatar_type=%s", avatar.id, avatar.avatar_type)
    return {"id": avatar.id, "message": "数字人配置创建成功"}


@router.put("/avatar/{avatar_id}/activate")
async def activate_avatar(
    avatar_id: int,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    logger.info("admin avatar activate start id=%s", avatar_id)
    avatar = db.query(AvatarConfig).filter(AvatarConfig.id == avatar_id).first()
    if not avatar:
        logger.warning("admin avatar activate missing id=%s", avatar_id)
        raise HTTPException(status_code=404, detail="配置不存在")
    db.query(AvatarConfig).update({"is_active": False})
    avatar.is_active = True
    db.commit()
    logger.info(
        "admin avatar activate done id=%s name=%s avatar_type=%s",
        avatar.id,
        avatar.name,
        avatar.avatar_type,
    )
    return {"message": f"已激活数字人：{avatar.name}"}


@router.put("/avatar/{avatar_id}")
async def update_avatar(
    avatar_id: int,
    config: AvatarConfigCreate,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    payload = _model_dump(config)
    logger.info(
        "admin avatar update start id=%s name=%s avatar_type=%s voice_id=%s",
        avatar_id,
        payload["name"],
        payload["avatar_type"],
        payload["voice_id"],
    )
    avatar = db.query(AvatarConfig).filter(AvatarConfig.id == avatar_id).first()
    if not avatar:
        logger.warning("admin avatar update missing id=%s", avatar_id)
        raise HTTPException(status_code=404, detail="配置不存在")
    for k, v in payload.items():
        setattr(avatar, k, v)
    db.commit()
    logger.info("admin avatar update done id=%s avatar_type=%s", avatar.id, avatar.avatar_type)
    return {"message": "更新成功"}


@router.get("/voices")
async def get_voices(_admin: dict = Depends(require_admin)):
    return {"voices": get_available_voices()}


# ── 知识库管理 ─────────────────────────────────────────────────
class KnowledgeCreate(BaseModel):
    title: str
    category: str
    content: str


def _brief_content(content: str | None, limit: int = 200) -> str:
    text = content or ""
    return text[:limit] + "..." if len(text) > limit else text


@router.get("/knowledge/list")
async def list_knowledge(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    docs = db.query(KnowledgeDoc).filter(KnowledgeDoc.is_active == True).all()
    indexed_docs = rag_service.get_all_documents()
    upload_only_docs = [d for d in indexed_docs if d.get("source") == "upload_file"]
    return {
        "builtin_docs": [
            {
                "id": d.get("id"),
                "title": d.get("title", ""),
                "category": d.get("category", "general"),
                "content": _brief_content(d.get("content")),
                "file_path": d.get("file_path", ""),
                "source": d.get("source", "upload_file"),
            }
            for d in upload_only_docs
        ],
        "custom_docs": [
            {
                "id": d.id,
                "title": d.title,
                "category": d.category,
                "content": _brief_content(d.content),
                "file_path": d.file_path,
                "created_at": d.created_at.isoformat(),
                "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            }
            for d in docs
        ],
        "index_status": rag_service.get_index_status(),
    }


async def _run_knowledge_reindex() -> dict:
    start = time.perf_counter()
    logger.info("admin knowledge reindex start")
    status = await rag_service.reload_from_database()
    logger.info(
        "admin knowledge reindex done initialized=%s documents=%s chunks=%s duration_ms=%s",
        status.get("initialized"),
        status.get("documents"),
        status.get("chunks"),
        elapsed_ms(start),
    )
    if not status.get("initialized") or (
        status.get("documents", 0) > 0 and status.get("chunks", 0) <= 0
    ):
        logger.error(
            "admin knowledge reindex failed initialized=%s documents=%s chunks=%s duration_ms=%s",
            status.get("initialized"),
            status.get("documents"),
            status.get("chunks"),
            elapsed_ms(start),
        )
        raise HTTPException(
            status_code=500,
            detail={
                "message": "知识库向量化失败，请检查后端日志、ChromaDB 状态和 Qwen Embedding API 配置",
                "index_status": status,
            },
        )
    return {
        "message": "知识库已重新扫描并完成向量化索引",
        "index_status": status,
    }


@router.post("/knowledge-index/rebuild")
async def rebuild_knowledge_index(_admin: dict = Depends(require_admin)):
    return await _run_knowledge_reindex()


@router.post("/knowledge/reindex")
async def reindex_knowledge(_admin: dict = Depends(require_admin)):
    """兼容旧前端路径；新前端使用 /knowledge-index/rebuild 避免和 /knowledge/{doc_id} 冲突。"""
    return await _run_knowledge_reindex()


@router.post("/knowledge/add")
async def add_knowledge(
    doc: KnowledgeCreate,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    content = doc.content.strip()
    if not doc.title.strip() or not content:
        raise HTTPException(status_code=400, detail="标题和内容不能为空")

    db_doc = KnowledgeDoc(
        title=doc.title.strip(),
        category=doc.category or "general",
        content=content,
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    file_path = rag_service.write_text_document_file(db_doc.id, db_doc.title, content)
    db_doc.file_path = file_path
    db.commit()
    db.refresh(db_doc)

    await rag_service.add_document(db_doc.id, db_doc.title, db_doc.category, db_doc.content, db_doc.file_path)
    return {"message": "知识文档添加成功", "doc_id": db_doc.id}


@router.post("/knowledge/upload")
async def upload_knowledge(
    file: UploadFile = File(...),
    category: str = Form("general"),
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    filename = file.filename or "knowledge.txt"
    suffix = Path(filename).suffix.lower()
    if suffix not in rag_service.SUPPORTED_FILE_SUFFIXES:
        supported = ", ".join(sorted(rag_service.SUPPORTED_FILE_SUFFIXES))
        raise HTTPException(status_code=400, detail=f"仅支持以下格式: {supported}")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="上传文件为空")

    title = Path(filename).stem
    db_doc = KnowledgeDoc(title=title, category=category or "general", content="")
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    os.makedirs(rag_service.upload_dir, exist_ok=True)
    safe_name = rag_service.safe_filename(filename)
    file_path = rag_service.upload_dir / f"db_{db_doc.id}_{safe_name}"
    try:
        file_path.write_bytes(data)
        content = rag_service.extract_file_content(file_path).strip()
        if not content:
            raise ValueError("文件中未解析到可用文本")
    except Exception as e:
        db.delete(db_doc)
        db.commit()
        try:
            file_path.unlink(missing_ok=True)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=f"解析知识库文件失败: {e}")

    db_doc.content = content
    db_doc.file_path = str(file_path)
    db.commit()
    db.refresh(db_doc)

    await rag_service.add_document(db_doc.id, db_doc.title, db_doc.category, db_doc.content, db_doc.file_path)
    return {"message": f"文档《{title}》上传成功，已加入知识库", "doc_id": db_doc.id}


@router.put("/knowledge/{doc_id}")
async def update_knowledge(
    doc_id: int,
    payload: KnowledgeCreate,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    doc = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not doc or not doc.is_active:
        raise HTTPException(status_code=404, detail="文档不存在")

    content = payload.content.strip()
    if not payload.title.strip() or not content:
        raise HTTPException(status_code=400, detail="标题和内容不能为空")

    doc.title = payload.title.strip()
    doc.category = payload.category or "general"
    doc.content = content

    existing_path = rag_service._resolve_file_path(doc.file_path)
    if existing_path and existing_path.suffix.lower() in rag_service.TEXT_FILE_SUFFIXES:
        existing_path.write_text(content, encoding="utf-8")
    elif not existing_path or not existing_path.exists():
        doc.file_path = rag_service.write_text_document_file(doc.id, doc.title, content)

    db.commit()
    db.refresh(doc)

    await rag_service.update_document(doc.id, doc.title, doc.category, doc.content, doc.file_path)
    return {"message": "知识文档更新成功", "doc_id": doc.id}


@router.delete("/knowledge/{doc_id}")
async def delete_knowledge(
    doc_id: int,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    doc = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")
    doc.is_active = False
    db.commit()
    await rag_service.delete_document(doc.id)
    return {"message": "文档已删除"}
