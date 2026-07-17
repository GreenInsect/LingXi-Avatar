"""
系统配置 - DashScope API + 本地 Embedding
  - Chat/Vision: DashScope API (qwen-plus / qwen-vl-plus)
  - Embedding: 本地 vLLM (Qwen3-Embedding-0.6B)
"""
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {
      "env_file": ".env",
      "extra": "ignore"  
    }
    # ── DashScope API（Chat + Vision）─
    DASHSCOPE_API_KEY: str = "sk-daf3711ed0dc47cdb216a01a73b32fae"
    DASHSCOPE_BASE_URL: str = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        validation_alias=AliasChoices("DASHSCOPE_BASE_URL", "VLLM_CHAT_BASE_URL"),
    )
    DASHSCOPE_VL_BASE_URL: str = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        validation_alias=AliasChoices("DASHSCOPE_VL_BASE_URL", "VLLM_VL_BASE_URL"),
    )
    QWEN_MODEL: str = "qwen-plus"
    QWEN_VL_MODEL: str = "qwen-vl-plus"

    # ── 本地 Embedding 模型 ─
    VLLM_EMBED_BASE_URL: str = "http://localhost:8003"
    EMBEDDING_MODEL: str = "Qwen/Qwen3-Embedding-0.6B"
    EMBEDDING_MODEL_PATH: str = "/var/tmp/Qwen3-Embedding-0.6B"

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
    DEFAULT_AVATAR: str = "lingxi"

    # ── 上传目录 ─
    UPLOAD_DIR: str = "./uploads"

    # ── 智能体配置 ─
    MAX_HISTORY_TURNS: int = 10
    RAG_TOP_K: int = 4
    MAX_IMAGE_SIZE: int = 1024

    # ── 调试/超时 ─
    LOG_LEVEL: str = "INFO"
    DASHSCOPE_CONNECT_TIMEOUT_SECONDS: float = 10.0
    DASHSCOPE_READ_TIMEOUT_SECONDS: float = 45.0
    CHAT_AGENT_TIMEOUT_SECONDS: float = 75.0
    TTS_TIMEOUT_SECONDS: float = 25.0
    MOUTH_ANALYSIS_TIMEOUT_SECONDS: float = 8.0
    RAG_SEARCH_TIMEOUT_SECONDS: float = 8.0
    SKIP_TTS_ON_AGENT_FALLBACK: bool = True
    RAG_MAX_DOC_CHARS_FOR_CHAT: int = 20000
    RAG_MAX_TOTAL_CHARS_FOR_CHAT: int = 200000
    RAG_MAX_UPLOAD_FILE_BYTES_FOR_CHAT: int = 5 * 1024 * 1024
    # 聊天请求里默认不首次加载本地向量模型，避免首问卡死/内存崩溃。
    # 管理后台上传/更新知识库仍会初始化并重建索引。
    RAG_INITIALIZE_ON_CHAT: bool = False


settings = Settings()
