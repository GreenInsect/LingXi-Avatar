"""
灵山胜境 AI 数字人导游系统 - 后端主程序
技术栈：FastAPI + LangGraph + Qwen/DashScope API + ChromaDB RAG
"""

from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api import chat, admin, analytics, tts, knowledge
from app.core.config import settings
from app.core.logging import (
    elapsed_ms,
    get_logger,
    new_request_id,
    reset_request_id,
    set_request_id,
    setup_logging,
)
from app.agent.rag_service import rag_service
# os.environ["TRANSFORMERS_OFFLINE"] = "1"

setup_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时初始化 RAG，关闭时清理"""
    logger.info("初始化灵山胜境 AI 导游系统（DashScope API 后端）")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.CHROMA_DB_DIR, exist_ok=True)
    os.makedirs(settings.KNOWLEDGE_BASE_DIR, exist_ok=True)

    # 初始化 RAG 知识库（连接公共 Qwen Embedding API）
    # rag_service.initialize()

    logger.info(
        "系统启动完成 chat_model=%s vl_model=%s embed_model=%s rag_initialize_on_chat=%s",
        settings.QWEN_MODEL,
        settings.QWEN_VL_MODEL,
        settings.EMBEDDING_MODEL,
        settings.RAG_INITIALIZE_ON_CHAT,
    )
    yield
    logger.info("系统关闭")


app = FastAPI(
    title="灵山胜境 AI 数字人导游系统",
    description="基于 LangGraph + Qwen/DashScope API 的智能景区导览系统",
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


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = (
        request.headers.get("x-request-id")
        or request.headers.get("x-correlation-id")
        or new_request_id()
    )
    token = set_request_id(request_id)
    start = time.perf_counter()
    client = request.client.host if request.client else "-"

    logger.info(
        "http request start method=%s path=%s client=%s",
        request.method,
        request.url.path,
        client,
    )
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "http request failed method=%s path=%s client=%s duration_ms=%s",
            request.method,
            request.url.path,
            client,
            elapsed_ms(start),
        )
        reset_request_id(token)
        raise

    response.headers["X-Request-ID"] = request_id
    logger.info(
        "http request done method=%s path=%s status=%s duration_ms=%s",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms(start),
    )
    reset_request_id(token)
    return response


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
        "inference_backend": "DashScope API + 公共 Qwen Embedding",
        "agent": "LangGraph + Qwen",
        "features": ["RAG知识库", "图像理解(VL)", "意图路由", "情感分析"],
        "endpoints": {
            "chat":  settings.DASHSCOPE_BASE_URL,
            "vl":    settings.DASHSCOPE_BASE_URL,
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
# uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload --reload-include '*.py' --reload-exclude 'ai_guide.db*' --reload-exclude 'chroma_db/*' --reload-exclude 'uploads/*'
