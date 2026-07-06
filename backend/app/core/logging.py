"""
统一日志工具。

所有请求日志都会带 request_id，方便把前端、Vite 代理和后端的同一次调用串起来。
"""
from __future__ import annotations

import contextvars
import logging
import os
import sys
import time
import uuid
from contextlib import contextmanager
from typing import Iterator

_request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id",
    default="-",
)
_configured = False


def _install_record_factory() -> None:
    old_factory = logging.getLogRecordFactory()
    if getattr(old_factory, "_lingshan_request_id_factory", False):
        return

    def record_factory(*args, **kwargs):
        record = old_factory(*args, **kwargs)
        record.request_id = _request_id_var.get("-")
        return record

    record_factory._lingshan_request_id_factory = True
    logging.setLogRecordFactory(record_factory)


def setup_logging(level: str | None = None) -> None:
    """配置应用日志格式，允许被重复调用。"""
    global _configured
    _install_record_factory()

    log_level = (level or os.getenv("LOG_LEVEL") or "INFO").upper()
    fmt = (
        "%(asctime)s | %(levelname)-8s | request_id=%(request_id)s | "
        "%(name)s:%(lineno)d | %(message)s"
    )
    datefmt = "%Y-%m-%d %H:%M:%S"

    root = logging.getLogger()
    root.setLevel(log_level)

    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(fmt=fmt, datefmt=datefmt))
        root.addHandler(handler)
    elif not _configured:
        for handler in root.handlers:
            handler.setFormatter(logging.Formatter(fmt=fmt, datefmt=datefmt))

    _configured = True


def get_logger(name: str) -> logging.Logger:
    setup_logging()
    return logging.getLogger(name)


def new_request_id(prefix: str = "req") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def get_request_id() -> str:
    return _request_id_var.get("-")


def set_request_id(request_id: str):
    return _request_id_var.set(request_id)


def reset_request_id(token) -> None:
    _request_id_var.reset(token)


def elapsed_ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


@contextmanager
def log_step(logger: logging.Logger, step: str, **fields) -> Iterator[None]:
    """记录一个同步代码块的开始、成功耗时和异常栈。"""
    start = time.perf_counter()
    extra = _format_fields(fields)
    logger.info("%s start%s", step, extra)
    try:
        yield
    except Exception:
        logger.exception("%s failed duration_ms=%s%s", step, elapsed_ms(start), extra)
        raise
    else:
        logger.info("%s done duration_ms=%s%s", step, elapsed_ms(start), extra)


def brief_text(value: object, limit: int = 120) -> str:
    text = "" if value is None else str(value)
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return f"{text[:limit]}..."


def _format_fields(fields: dict) -> str:
    clean = {key: value for key, value in fields.items() if value is not None}
    if not clean:
        return ""
    return " " + " ".join(f"{key}={value}" for key, value in clean.items())
