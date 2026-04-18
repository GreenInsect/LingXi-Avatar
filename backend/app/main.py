"""
灵山胜境 AI 数字人导游系统 - 后端主程序
技术栈：FastAPI + LangGraph + Qwen3(vLLM) + ChromaDB RAG
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api import chat, admin, analytics, tts, knowledge
from app.core.config import settings
from app.agent.rag_service import rag_service
# os.environ["TRANSFORMERS_OFFLINE"] = "1"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时初始化 RAG，关闭时清理"""
    print("🚀 初始化灵山胜境 AI 导游系统（vLLM 推理后端）...")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.CHROMA_DB_DIR, exist_ok=True)
    os.makedirs(settings.KNOWLEDGE_BASE_DIR, exist_ok=True)

    # 初始化 RAG 知识库（连接 vLLM Embedding 服务）
    # rag_service.initialize()

    print("✅ 系统启动完成")
    yield
    print("🛑 系统关闭")


app = FastAPI(
    title="灵山胜境 AI 数字人导游系统",
    description="基于 LangGraph + Qwen3(vLLM) 的智能景区导览系统",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(chat.router,      prefix="/api/chat",      tags=["对话交互"])
app.include_router(tts.router,       prefix="/api/tts",       tags=["语音合成"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["知识库查询"])
app.include_router(admin.router,     prefix="/api/admin",     tags=["管理后台"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["数据分析"])


@app.get("/")
async def root():
    return {
        "system": "灵山胜境 AI 数字人导游",
        "version": "2.1.0",
        "inference_backend": "vLLM",
        "agent": "LangGraph + Qwen3",
        "features": ["RAG知识库", "图像理解(VL)", "意图路由", "情感分析"],
        "vllm_endpoints": {
            "chat":  settings.VLLM_CHAT_BASE_URL,
            "vl":    settings.VLLM_VL_BASE_URL,
            "embed": settings.VLLM_EMBED_BASE_URL,
        },
    }


@app.get("/health")
async def health():
    from app.agent.qwen_client import qwen_client
    vllm_status = await qwen_client.health_check()
    return {
        "status": "healthy",
        "rag": rag_service._initialized,
        "vllm": vllm_status,
    }
# uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload