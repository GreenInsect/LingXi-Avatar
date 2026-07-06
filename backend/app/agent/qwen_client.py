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
import time
from typing import AsyncIterator, Optional

import httpx

from app.core.config import settings
from app.core.logging import brief_text, elapsed_ms, get_logger

logger = get_logger(__name__)

_TIMEOUT = httpx.Timeout(
    settings.DASHSCOPE_READ_TIMEOUT_SECONDS,
    connect=settings.DASHSCOPE_CONNECT_TIMEOUT_SECONDS,
)

# DashScope OpenAI 兼容接口
_BASE_URL = settings.DASHSCOPE_BASE_URL.rstrip("/")
_VL_BASE_URL = settings.DASHSCOPE_VL_BASE_URL.rstrip("/")
_API_KEY = settings.DASHSCOPE_API_KEY


def _messages_chars(messages: list[dict]) -> int:
    total = 0
    for message in messages:
        content = message.get("content", "")
        if isinstance(content, str):
            total += len(content)
        elif isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    total += len(str(item.get("text", "")))
        else:
            total += len(str(content))
    return total


def _http_error_detail(exc: httpx.HTTPStatusError) -> str:
    response = exc.response
    body = brief_text(response.text, 500) if response is not None else ""
    status = response.status_code if response is not None else "-"
    return f"status={status} body={body}"


class QwenClient:
    """Qwen 系列模型统一客户端 — Chat/VL 通过 DashScope API"""

    def __init__(self):
        self.chat_base = f"{_BASE_URL}/chat/completions"
        self.vl_base = f"{_VL_BASE_URL}/chat/completions"
        self.model = settings.QWEN_MODEL
        self.vl_model = settings.QWEN_VL_MODEL
        logger.info(
            "qwen client initialized base_url=%s vl_base_url=%s chat_model=%s vl_model=%s timeout_read=%s timeout_connect=%s",
            _BASE_URL,
            _VL_BASE_URL,
            self.model,
            self.vl_model,
            settings.DASHSCOPE_READ_TIMEOUT_SECONDS,
            settings.DASHSCOPE_CONNECT_TIMEOUT_SECONDS,
        )

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
        start = time.perf_counter()
        logger.info(
            "qwen chat start model=%s messages=%s input_chars=%s max_tokens=%s temperature=%s",
            payload["model"],
            len(messages),
            _messages_chars(messages),
            max_tokens,
            temperature,
        )
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(self.chat_base, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                logger.info(
                    "qwen chat done model=%s status=%s output_chars=%s duration_ms=%s",
                    payload["model"],
                    resp.status_code,
                    len(content),
                    elapsed_ms(start),
                )
                return content
        except httpx.HTTPStatusError as e:
            logger.exception(
                "qwen chat http error model=%s duration_ms=%s %s",
                payload["model"],
                elapsed_ms(start),
                _http_error_detail(e),
            )
            raise
        except Exception:
            logger.exception(
                "qwen chat failed model=%s duration_ms=%s",
                payload["model"],
                elapsed_ms(start),
            )
            raise

    async def chat_stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 512,
        model: Optional[str] = None,
    ) -> AsyncIterator[str]:
        """流式文本对话，逐段产出模型生成的 delta content。"""
        payload = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {_API_KEY}",
        }
        start = time.perf_counter()
        chunk_count = 0
        output_chars = 0
        logger.info(
            "qwen stream start model=%s messages=%s input_chars=%s max_tokens=%s temperature=%s",
            payload["model"],
            len(messages),
            _messages_chars(messages),
            max_tokens,
            temperature,
        )
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    self.chat_base,
                    json=payload,
                    headers=headers,
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue

                        data = line[5:].strip() if line.startswith("data:") else line
                        if data == "[DONE]":
                            break

                        try:
                            chunk = json.loads(data)
                        except json.JSONDecodeError:
                            logger.debug("qwen stream ignored non-json line=%s", brief_text(data, 120))
                            continue

                        choices = chunk.get("choices") or []
                        if not choices:
                            continue

                        delta = choices[0].get("delta") or {}
                        content = delta.get("content")
                        if content:
                            chunk_count += 1
                            output_chars += len(content)
                            logger.debug(
                                "qwen stream chunk index=%s chars=%s preview=%s",
                                chunk_count,
                                len(content),
                                brief_text(content, 60),
                            )
                            yield content
                    logger.info(
                        "qwen stream done model=%s chunks=%s output_chars=%s duration_ms=%s",
                        payload["model"],
                        chunk_count,
                        output_chars,
                        elapsed_ms(start),
                    )
        except httpx.HTTPStatusError as e:
            logger.exception(
                "qwen stream http error model=%s duration_ms=%s %s",
                payload["model"],
                elapsed_ms(start),
                _http_error_detail(e),
            )
            raise
        except Exception:
            logger.exception(
                "qwen stream failed model=%s chunks=%s duration_ms=%s",
                payload["model"],
                chunk_count,
                elapsed_ms(start),
            )
            raise

    async def chat_json(
        self,
        messages: list[dict],
        temperature: float = 0.0,
        max_tokens: int = 300,
    ) -> dict:
        logger.info("qwen chat_json start max_tokens=%s temperature=%s", max_tokens, temperature)
        raw = await self.chat(messages, temperature=temperature, max_tokens=max_tokens)
        raw = re.sub(r"^```(?:json)?\s*|```$", "", raw, flags=re.MULTILINE).strip()
        try:
            parsed = json.loads(raw)
            logger.info("qwen chat_json parsed keys=%s", list(parsed.keys()) if isinstance(parsed, dict) else "-")
            return parsed
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group())
                    logger.info(
                        "qwen chat_json parsed from embedded json keys=%s",
                        list(parsed.keys()) if isinstance(parsed, dict) else "-",
                    )
                    return parsed
                except Exception:
                    pass
        logger.warning("qwen chat_json parse failed raw=%s", brief_text(raw, 500))
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
        start = time.perf_counter()
        logger.info(
            "qwen vision start model=%s prompt_chars=%s image_chars=%s mime_type=%s max_tokens=%s",
            self.vl_model,
            len(text_prompt or ""),
            len(image_base64 or ""),
            mime_type,
            max_tokens,
        )
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(self.vl_base, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                logger.info(
                    "qwen vision done model=%s status=%s output_chars=%s duration_ms=%s",
                    self.vl_model,
                    resp.status_code,
                    len(content),
                    elapsed_ms(start),
                )
                return content
        except httpx.HTTPStatusError as e:
            logger.exception(
                "qwen vision http error model=%s duration_ms=%s %s",
                self.vl_model,
                elapsed_ms(start),
                _http_error_detail(e),
            )
            raise
        except Exception:
            logger.exception(
                "qwen vision failed model=%s duration_ms=%s",
                self.vl_model,
                elapsed_ms(start),
            )
            raise

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
                        f"{(_VL_BASE_URL if key == 'vl' else _BASE_URL)}/models",
                        headers={"Authorization": f"Bearer {_API_KEY}"},
                    )
                    if resp.status_code == 200:
                        result[key]["ok"] = True
            except Exception as e:
                result[key]["error"] = str(e)
                logger.exception("qwen health probe failed key=%s", key)

        import asyncio
        await asyncio.gather(
            _probe(self.chat_base, "chat"),
            _probe(self.vl_base, "vl"),
        )
        return result


# 全局单一实例
qwen_client = QwenClient()
