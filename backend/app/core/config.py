"""
系统配置 - 基于 vLLM 本地推理服务

vLLM 暴露 OpenAI 兼容接口：
  - /v1/chat/completions  → 文本对话（Qwen3-VL）
  - /v1/chat/completions  → 多模态对话（Qwen3-VL）
  - /v1/embeddings        → 向量嵌入（Qwen3-Embedding-0.6B / Qwen）

每类模型建议独立启动一个 vLLM 进程（不同端口）。
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # vLLM 推理服务地址 
    # 主对话模型（Qwen3-VL-8B-Instruct）
    # VLLM_CHAT_BASE_URL: str = "http://localhost:8001"
    VLLM_CHAT_BASE_URL: str = "http://localhost:8001"
    QWEN_MODEL: str = "Qwen/Qwen3-VL-8B-Instruct"

    # 视觉语言模型（Qwen3-VL-8B-Instruct）
    VLLM_VL_BASE_URL: str = "http://localhost:8001"
    QWEN_VL_MODEL: str = "Qwen/Qwen3-VL-8B-Instruct"

    # Embedding 模型（Qwen3-Embedding-0.6B，支持中文语义检索）
    VLLM_EMBED_BASE_URL: str = "http://localhost:8003"
    EMBEDDING_MODEL: str = "Qwen/Qwen3-Embedding-0.6B"
    EMBEDDING_MODEL_PATH: str = "/home/hk/Qwen3-Embedding-0.6B"

    DASHSCOPE_API_KEY: str = "your-dashscope-api-key"  # DashScope API Key

    # 数据库 
    DATABASE_URL: str = "sqlite:///./ai_guide.db"

    # JWT 
    SECRET_KEY: str = "lingshan-scenic-secret-key-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # 知识库 
    KNOWLEDGE_BASE_DIR: str = "./knowledge_base"
    CHROMA_DB_DIR: str = "./chroma_db"

    # 语音合成 
    TTS_PROVIDER: str = "edge-tts"
    TTS_MODEL: str = "qwen3-tts-flash"

    # 数字人 
    DEFAULT_AVATAR: str = "guide_female"

    # 上传目录 
    UPLOAD_DIR: str = "./uploads"

    # 智能体配置
    MAX_HISTORY_TURNS: int = 10
    RAG_TOP_K: int = 4
    MAX_IMAGE_SIZE: int = 1024

    class Config:
        env_file = ".env"


settings = Settings()
