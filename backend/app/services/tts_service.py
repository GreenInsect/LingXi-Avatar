"""
语音合成服务 - 阿里云 DashScope Qwen-TTS
"""
import asyncio
import io
import base64
import contextlib
import time
import wave

import httpx
import dashscope
from app.core.config import settings
from app.core.logging import brief_text, elapsed_ms, get_logger

logger = get_logger(__name__)


async def synthesize_speech(text: str, voice_id: str = "Cherry", emotion: str = None):
    """对接阿里云 Qwen-TTS 并返回 base64 和 duration"""
    start = time.perf_counter()
    model = settings.TTS_MODEL or "qwen3-tts-flash"
    logger.info(
        "tts start model=%s voice_id=%s emotion=%s text_chars=%s text_preview=%s timeout_seconds=%s",
        model,
        voice_id,
        emotion,
        len(text or ""),
        brief_text(text, 120),
        settings.TTS_TIMEOUT_SECONDS,
    )
    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(
                dashscope.MultiModalConversation.call,
                model=model,
                text=text,
                voice=voice_id,
                api_key=settings.DASHSCOPE_API_KEY,
            ),
            timeout=settings.TTS_TIMEOUT_SECONDS,
        )

        if response.status_code != 200:
            logger.error(
                "tts provider returned error status=%s message=%s duration_ms=%s",
                getattr(response, "status_code", "-"),
                brief_text(getattr(response, "message", ""), 300),
                elapsed_ms(start),
            )
            return {"audio_base64": None, "duration": 0}

        audio_url = response.output.audio.url
        logger.info(
            "tts provider done status=%s has_audio_url=%s duration_ms=%s",
            getattr(response, "status_code", "-"),
            bool(audio_url),
            elapsed_ms(start),
        )

        download_start = time.perf_counter()
        async with httpx.AsyncClient(timeout=httpx.Timeout(settings.TTS_TIMEOUT_SECONDS, connect=10.0)) as client:
            resp = await client.get(audio_url)
            resp.raise_for_status()
            audio_data = resp.content
        logger.info(
            "tts audio download done status=%s bytes=%s duration_ms=%s",
            resp.status_code,
            len(audio_data),
            elapsed_ms(download_start),
        )

        # 计算音频时长：优先 WAV 头解析，异常时字数估算
        audio_size = len(audio_data)
        duration = 0
        # 检查 WAV RIFF 头
        if audio_size > 44 and audio_data[:4] == b'RIFF':
            try:
                with contextlib.closing(wave.open(io.BytesIO(audio_data), 'rb')) as f:
                    frames = f.getnframes()
                    rate = f.getframerate()
                    if 8000 <= rate <= 48000 and 0 < frames < audio_size:
                        duration = frames / float(rate)
            except Exception as e:
                logger.warning("tts wav duration parse failed error=%s", e)
        if duration <= 0:
            duration = len(text) / 4.0  # 中文约4字/秒

        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        logger.info(
            "tts done audio_bytes=%s audio_base64_chars=%s audio_duration=%.2f duration_ms=%s",
            len(audio_data),
            len(audio_base64),
            duration,
            elapsed_ms(start),
        )

        return {
            "audio_base64": audio_base64,
            "duration": duration,
            "audio_data": audio_data,  # 原始 WAV 字节，供 ML 嘴型模型
        }

    except asyncio.TimeoutError:
        logger.exception(
            "tts timeout timeout_seconds=%s duration_ms=%s",
            settings.TTS_TIMEOUT_SECONDS,
            elapsed_ms(start),
        )
        return {"audio_base64": None, "duration": 0}
    except Exception as e:
        logger.exception("tts failed duration_ms=%s error=%s", elapsed_ms(start), e)
        return {"audio_base64": None, "duration": 0}


def get_available_voices() -> list:
    """获取可用语音列表"""
    return [
        {"id": "Cherry", "name": "芊悦", "gender": "female", "style": "阳光积极、亲切自然小姐姐"},
        {"id": "Serena", "name": "苏瑶", "gender": "female", "style": "温柔小姐姐"},
        {"id": "Ethan", "name": "晨煦", "gender": "male", "style": "标准普通话，带部分北方口音。阳光、温暖、活力、朝气"},
        {"id": "Chelsie", "name": "千雪", "gender": "female", "style": "二次元虚拟女友"},
        {"id": "Momo", "name": "茉兔", "gender": "female", "style": "撒娇搞怪，逗你开心"},
        {"id": "Moon", "name": "月白", "gender": "male", "style": "率性帅气的月白"},
    ]
