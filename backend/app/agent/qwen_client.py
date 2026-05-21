"""
Qwen 模型客户端 - DashScope API (Chat/VL) + 本地 Embedding

DashScope 暴露 OpenAI 兼容接口：
  - /v1/chat/completions  → 文本对话（qwen-plus）
  - /v1/chat/completions  → 多模态对话（qwen-vl-plus）
  - Embedding: 本地 vLLM / SentenceTransformer
"""
from __future__ import annotations

import base64
import json
import re
from typing import Optional

import httpx

from app.core.config import settings

_TIMEOUT = httpx.Timeout(120.0, connect=15.0)

# DashScope OpenAI 兼容接口
_BASE_URL = settings.DASHSCOPE_BASE_URL.rstrip("/")
_API_KEY = settings.DASHSCOPE_API_KEY


class QwenClient:
    """Qwen 系列模型统一客户端 — Chat/VL 通过 DashScope API"""

    def __init__(self):
        self.chat_base = f"{_BASE_URL}/chat/completions"
        self.vl_base = f"{_BASE_URL}/chat/completions"
        self.model = settings.QWEN_MODEL
        self.vl_model = settings.QWEN_VL_MODEL

    async def chat(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 512,
        model: Optional[str] = None,
    ) -> str:
        payload = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {_API_KEY}",
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(self.chat_base, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()

    async def chat_json(
        self,
        messages: list[dict],
        temperature: float = 0.0,
        max_tokens: int = 300,
    ) -> dict:
        raw = await self.chat(messages, temperature=temperature, max_tokens=max_tokens)
        raw = re.sub(r"^```(?:json)?\s*|```$", "", raw, flags=re.MULTILINE).strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except Exception:
                    pass
        return {}

    async def vision_chat(
        self,
        text_prompt: str,
        image_base64: str,
        mime_type: str = "image/jpeg",
        temperature: float = 0.5,
        max_tokens: int = 512,
    ) -> str:
        data_uri = f"data:{mime_type};base64,{image_base64}"

        content = [
            {
                "type": "image_url",
                "image_url": {"url": data_uri, "detail": "high"},
            },
            {"type": "text", "text": text_prompt},
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
            "Authorization": f"Bearer {_API_KEY}",
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(self.vl_base, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()

    async def health_check(self) -> dict:
        """检查 DashScope API 可用性"""
        result = {
            "chat":  {"ok": False, "model": self.model, "backend": "DashScope"},
            "vl":    {"ok": False, "model": self.vl_model, "backend": "DashScope"},
        }

        async def _probe(url: str, key: str):
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                    resp = await client.get(
                        f"{_BASE_URL}/models",
                        headers={"Authorization": f"Bearer {_API_KEY}"},
                    )
                    if resp.status_code == 200:
                        result[key]["ok"] = True
            except Exception as e:
                result[key]["error"] = str(e)

        import asyncio
        await asyncio.gather(
            _probe(self.chat_base, "chat"),
            _probe(self.vl_base, "vl"),
        )
        return result


# 全局单一实例
qwen_client = QwenClient()
