"""
管理后台 API
"""
import os, uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.models.database import get_db, AvatarConfig, KnowledgeDoc
from app.agent.rag_service import rag_service
from app.agent.qwen_client import qwen_client
from app.services.tts_service import get_available_voices
from app.core.config import settings

router = APIRouter()


# ── 系统健康检查 ───────────────────────────────────────────────
@router.get("/health")
async def system_health():
    """检查三个 vLLM 服务进程 + RAG 可用性"""
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
class AvatarConfigCreate(BaseModel):
    name: str
    avatar_type: str = "guide_female"
    voice_id: str = "zh-CN-XiaoxiaoNeural"
    personality: str = "热情友善、知识渊博、善于沟通，具有亲和力"
    greeting: str = "您好！我是灵山胜境AI导游小慧，很高兴为您服务！"


@router.get("/avatar/list")
async def list_avatars(db: Session = Depends(get_db)):
    avatars = db.query(AvatarConfig).all()
    if not avatars:
        default = AvatarConfig(
            name="小慧",
            avatar_type="guide_female",
            voice_id="zh-CN-XiaoxiaoNeural",
            personality="热情友善、知识渊博、善于沟通，说话亲切自然，擅长将景区故事娓娓道来",
            greeting="您好！我是灵山胜境AI导游小慧 🌸，很高兴为您服务！请问您想了解什么？",
            is_active=True,
        )
        db.add(default)
        db.commit()
        db.refresh(default)
        avatars = [default]
    return {"avatars": [
        {"id": a.id, "name": a.name, "avatar_type": a.avatar_type,
         "voice_id": a.voice_id, "personality": a.personality,
         "greeting": a.greeting, "is_active": a.is_active,
         "created_at": a.created_at.isoformat()}
        for a in avatars
    ]}


@router.post("/avatar/create")
async def create_avatar(config: AvatarConfigCreate, db: Session = Depends(get_db)):
    avatar = AvatarConfig(**config.dict())
    db.add(avatar)
    db.commit()
    db.refresh(avatar)
    return {"id": avatar.id, "message": "数字人配置创建成功"}


@router.put("/avatar/{avatar_id}/activate")
async def activate_avatar(avatar_id: int, db: Session = Depends(get_db)):
    db.query(AvatarConfig).update({"is_active": False})
    avatar = db.query(AvatarConfig).filter(AvatarConfig.id == avatar_id).first()
    if not avatar:
        raise HTTPException(status_code=404, detail="配置不存在")
    avatar.is_active = True
    db.commit()
    return {"message": f"已激活数字人：{avatar.name}"}


@router.put("/avatar/{avatar_id}")
async def update_avatar(avatar_id: int, config: AvatarConfigCreate, db: Session = Depends(get_db)):
    avatar = db.query(AvatarConfig).filter(AvatarConfig.id == avatar_id).first()
    if not avatar:
        raise HTTPException(status_code=404, detail="配置不存在")
    for k, v in config.dict().items():
        setattr(avatar, k, v)
    db.commit()
    return {"message": "更新成功"}


@router.get("/voices")
async def get_voices():
    return {"voices": get_available_voices()}


# ── 知识库管理 ─────────────────────────────────────────────────
class KnowledgeCreate(BaseModel):
    title: str
    category: str
    content: str


@router.get("/knowledge/list")
async def list_knowledge(db: Session = Depends(get_db)):
    docs = db.query(KnowledgeDoc).filter(KnowledgeDoc.is_active == True).all()
    builtin = rag_service.get_all_documents()
    return {
        "builtin_docs": builtin,
        "custom_docs": [
            {"id": d.id, "title": d.title, "category": d.category,
             "content": d.content[:200] + "..." if len(d.content) > 200 else d.content,
             "created_at": d.created_at.isoformat()}
            for d in docs
        ],
    }


@router.post("/knowledge/add")
async def add_knowledge(doc: KnowledgeCreate, db: Session = Depends(get_db)):
    doc_id = f"custom_{uuid.uuid4().hex[:8]}"
    db_doc = KnowledgeDoc(title=doc.title, category=doc.category, content=doc.content)
    db.add(db_doc)
    db.commit()
    await rag_service.add_document(doc_id, doc.title, doc.category, doc.content)
    return {"message": "知识文档添加成功", "doc_id": doc_id}


@router.post("/knowledge/upload")
async def upload_knowledge(file: UploadFile = File(...), category: str = "general", db: Session = Depends(get_db)):
    if not file.filename.endswith((".txt", ".md")):
        raise HTTPException(status_code=400, detail="仅支持txt和md格式")
    content = (await file.read()).decode("utf-8")
    doc_id = f"upload_{uuid.uuid4().hex[:8]}"
    title = file.filename.replace(".txt", "").replace(".md", "")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, f"{doc_id}_{file.filename}")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    db_doc = KnowledgeDoc(title=title, category=category, content=content, file_path=file_path)
    db.add(db_doc)
    db.commit()
    await rag_service.add_document(doc_id, title, category, content)
    return {"message": f"文档《{title}》上传成功，已加入知识库"}


@router.delete("/knowledge/{doc_id}")
async def delete_knowledge(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")
    doc.is_active = False
    db.commit()
    return {"message": "文档已删除"}
