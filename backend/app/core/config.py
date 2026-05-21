"""
系统配置 - DashScope API + 本地 Embedding
  - Chat/Vision: DashScope API (qwen-plus / qwen-vl-plus)
  - Embedding: 本地 vLLM (Qwen3-Embedding-0.6B)
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── DashScope API（Chat + Vision）─
    DASHSCOPE_API_KEY: str = "sk-daf3711ed0dc47cdb216a01a73b32fae"
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    QWEN_MODEL: str = "qwen-plus"
    QWEN_VL_MODEL: str = "qwen-vl-plus"

    # ── 本地 Embedding 模型 ─
    VLLM_EMBED_BASE_URL: str = "http://localhost:8003"
    EMBEDDING_MODEL: str = "Qwen/Qwen3-Embedding-0.6B"
    EMBEDDING_MODEL_PATH: str = "/home/xls/.cache/modelscope/hub/models/Qwen/Qwen3-Embedding-0.6B"

    # ── 数据库 ─
    DATABASE_URL: str = "sqlite:///./ai_guide.db"

    # ── JWT ─
    SECRET_KEY: str = "lingshan-scenic-secret-key-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # ── 知识库 ─
    KNOWLEDGE_BASE_DIR: str = "./knowledge_base"
    CHROMA_DB_DIR: str = "./chroma_db"

    # ── 语音合成 ─
    TTS_PROVIDER: str = "edge-tts"
    TTS_MODEL: str = "qwen3-tts-flash"

    # ── 数字人 ─
    DEFAULT_AVATAR: str = "guide_female"

    # ── 上传目录 ─
    UPLOAD_DIR: str = "./uploads"

    # ── 智能体配置 ─
    MAX_HISTORY_TURNS: int = 10
    RAG_TOP_K: int = 4
    MAX_IMAGE_SIZE: int = 1024

    class Config:
        env_file = ".env"


settings = Settings()
