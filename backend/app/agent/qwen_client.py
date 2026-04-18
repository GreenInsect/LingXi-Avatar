"""
Qwen 模型客户端 - vLLM 本地模型加载(效果要是不好换成 API)

vLLM 对外暴露与 OpenAI 完全兼容的 REST API:
  - 文本对话：POST {VLLM_CHAT_BASE_URL}/v1/chat/completions
  - 多模态VL：POST {VLLM_VL_BASE_URL}/v1/chat/completions  （image_url 方式）
  - 文本嵌入：POST {VLLM_EMBED_BASE_URL}/v1/embeddings

  # 对话模型 & 视觉语言模型
  python -m vllm.entrypoints.openai.api_server \
    --model /path/to/Qwen3-VL-8B-Instruct \
    --served-model-name qwen3-vl \
    --port 8001 \
    --trust-remote-code \
    --gpu-memory-utilization 0.6 \
    --max-model-len 4096 \
    --limit-mm-per-prompt image=1

  # 嵌入模型
  python -m vllm.entrypoints.openai.api_server \
    --model /path/to/Qwen3-Embedding-0.6B \
    --served-model-name qwen3-emb \
    --port 8003 \
    --task embedding \
    --trust-remote-code \
    --gpu-memory-utilization 0.1 \
    --dtype float16
"""
from __future__ import annotations

import base64
import json
import re
from typing import Optional

import httpx

from app.core.config import settings

# HTTP 超时（vLLM 首次推理可能需要较长预热时间）
_TIMEOUT = httpx.Timeout(180.0, connect=15.0)

# vLLM 鉴权占位（vLLM 默认不需要 Key，设为固定字符串即可）
_FAKE_API_KEY = "LinXi-Local-vLLM-Key"
DASHSCOPE_API_KEY = settings.DASHSCOPE_API_KEY
MODEL_KEY = DASHSCOPE_API_KEY


class QwenClient:
    """
    Qwen 系列模型统一客户端

    调用路径：
      chat()        → vLLM Chat 进程（:8001）  /v1/chat/completions
      vision_chat() → vLLM VL  进程（:8001）  /v1/chat/completions + image_url
      embed()       → vLLM Emb 进程（:8003）  /v1/embeddings
    """

    def __init__(self):
        self.chat_base   = settings.VLLM_CHAT_BASE_URL.rstrip("/")
        self.vl_base     = settings.VLLM_VL_BASE_URL.rstrip("/")
        self.embed_base  = settings.VLLM_EMBED_BASE_URL.rstrip("/")
        self.model       = settings.QWEN_MODEL
        self.vl_model    = settings.QWEN_VL_MODEL
        self.embed_model = settings.EMBEDDING_MODEL


    # 文本对话
    async def chat(
        self,
        # [{"role": "user", "content": "..."}, ...] 对话历史
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 512,
        model: Optional[str] = None,
    ) -> str:
        """
        默认的模型对话函数\n
        调用 vLLM /v1/chat/completions
        """
        payload = {
            "model": model or self.model,
            "messages": messages,
            # 意图识别传入 0.0
            "temperature": temperature,        
            "max_tokens": max_tokens,
            "stream": False,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {MODEL_KEY}",
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{self.chat_base}/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()

    async def chat_json(
        self,
        messages: list[dict],
        temperature: float = 0.0,
        max_tokens: int = 300,
    ) -> dict:
        """
        调用对话模型并解析 JSON 输出\n
        对于结构化输出（意图分类/情感分析），优先使用低温度确保稳定性。
        """
        raw = await self.chat(messages, temperature=temperature, max_tokens=max_tokens)
        # 去除 Markdown 代码块包裹（防止模型会加 ```json ... ```）
        raw = re.sub(r"^```(?:json)?\s*|```$", "", raw, flags=re.MULTILINE).strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # 尝试从文本中提取第一个完整 JSON 对象
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except Exception:
                    pass
        return {}


    # 多模态视觉语言（VL）
    async def vision_chat(
        self,
        text_prompt: str,
        image_base64: str,
        mime_type: str = "image/jpeg",
        temperature: float = 0.5,
        max_tokens: int = 512,
    ) -> str:
        """
        调用 Qwen3-VL vLLM /v1/chat/completions 进行图文对话
        """
        # 构造 data URI
        data_uri = f"data:{mime_type};base64,{image_base64}"

        # OpenAI Vision 格式 content 列表
        content = [
            {
                "type": "image_url",
                "image_url": {
                    "url": data_uri,
                    "detail": "high",   # "low" / "high" / "auto"
                },
            },
            {
                "type": "text",
                "text": text_prompt,
            },
        ]

        payload = {
            "model": self.vl_model,
            "messages": [{"role": "user", "content": content}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {MODEL_KEY}",
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{self.vl_base}/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()


    # # 文本嵌入（RAG 向量化）
    # async def embed(self, text: str) -> list[float]:
    #     """
    #     调用 vLLM /v1/embeddings 生成文本向量
    #     """
    #     payload = {
    #         "model": self.embed_model,
    #         "input": text,
    #     }
    #     headers = {
    #         "Content-Type": "application/json",
    #         "Authorization": f"Bearer {MODEL_KEY}",
    #     }
    #     async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
    #         resp = await client.post(
    #             f"{self.embed_base}/embeddings",
    #             json=payload,
    #             headers=headers,
    #         )
    #         resp.raise_for_status()
    #         data = resp.json()
    #         return data["data"][0]["embedding"]

    # async def embed_batch(self, texts: list[str]) -> list[list[float]]:
    #     """
    #     批量文本嵌入
    #     """
    #     if not texts:
    #         return []

    #     payload = {
    #         "model": self.embed_model,
    #         "input": texts,   # 传列表，vLLM 一次处理
    #     }
    #     headers = {
    #         "Content-Type": "application/json",
    #         "Authorization": f"Bearer {MODEL_KEY}",
    #     }
    #     async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
    #         resp = await client.post(
    #             f"{self.embed_base}/embeddings",
    #             json=payload,
    #             headers=headers,
    #         )
    #         resp.raise_for_status()
    #         data = resp.json()
    #         # 按 index 排序，确保返回顺序与输入一致
    #         items = sorted(data["data"], key=lambda x: x["index"])
    #         return [item["embedding"] for item in items]


    # 健康检查
    async def health_check(self) -> dict:
        """
        检查三个 vLLM 服务进程的可用性和加载的模型列表
        """
        result = {
            "vllm_chat":  {"ok": False, "model": self.model},
            "vllm_vl":    {"ok": False, "model": self.vl_model},
            "vllm_embed": {"ok": False, "model": self.embed_model},
        }

        async def _probe(base_url: str, key: str):
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
                    resp = await client.get(
                        f"{base_url}/models",
                        headers={"Authorization": f"Bearer {MODEL_KEY}"},
                    )
                    if resp.status_code == 200:
                        models_data = resp.json().get("data", [])
                        loaded = [m.get("id", "") for m in models_data]
                        result[key]["ok"] = True
                        result[key]["loaded_models"] = loaded
            except Exception as e:
                result[key]["error"] = str(e)

        import asyncio
        await asyncio.gather(
            _probe(self.chat_base,  "vllm_chat"),
            _probe(self.vl_base,    "vllm_vl"),
            _probe(self.embed_base, "vllm_embed"),
        )
        return result


# 全局单一实例
qwen_client = QwenClient()
