"""
语音合成服务 - 阿里云百炼 Qwen-Audio TTS
"""
import asyncio
import io
import base64
import contextlib
import time
import wave

import dashscope
from app.core.config import settings
from app.core.logging import brief_text, elapsed_ms, get_logger

logger = get_logger(__name__)

DEFAULT_QWEN_TTS_MODEL = "qwen-audio-3.0-tts-flash"
DEFAULT_QWEN_TTS_VOICE = "longanhuan_v3.6"

LEGACY_VOICE_MAP = {
    # 旧 Qwen-TTS / 后台已有配置。新版 qwen-audio-3.0-tts-* 不支持这些音色。
    "Cherry": DEFAULT_QWEN_TTS_VOICE,
    "Serena": DEFAULT_QWEN_TTS_VOICE,
    "Ethan": DEFAULT_QWEN_TTS_VOICE,
    "Chelsie": DEFAULT_QWEN_TTS_VOICE,
    "Momo": DEFAULT_QWEN_TTS_VOICE,
    "Moon": DEFAULT_QWEN_TTS_VOICE,
    # 旧 Edge TTS 兜底项。
    "zh-CN-XiaohanNeural": DEFAULT_QWEN_TTS_VOICE,
    "zh-CN-YunxiNeural": DEFAULT_QWEN_TTS_VOICE,
    "zh-CN-YunjianNeural": DEFAULT_QWEN_TTS_VOICE,
    "zh-CN-YunyangNeural": DEFAULT_QWEN_TTS_VOICE,
}


def _resolve_tts_model() -> str:
    model = (settings.TTS_MODEL or DEFAULT_QWEN_TTS_MODEL).strip()
    model_lower = model.lower()
    if "asr" in model_lower or model_lower.startswith("sambert"):
        logger.warning(
            "tts model unsupported by qwen tts service model=%s fallback=%s",
            model,
            DEFAULT_QWEN_TTS_MODEL,
        )
        return DEFAULT_QWEN_TTS_MODEL
    return model


def _resolve_tts_voice(voice_id: str | None) -> str:
    voice = (voice_id or settings.TTS_VOICE or DEFAULT_QWEN_TTS_VOICE).strip()
    mapped = LEGACY_VOICE_MAP.get(voice, voice)
    if mapped != voice:
        logger.info("tts voice mapped legacy_voice=%s qwen_audio_voice=%s", voice, mapped)
    return mapped


def _build_instruction(emotion: str | None) -> str | None:
    if settings.TTS_INSTRUCTION:
        return settings.TTS_INSTRUCTION.strip()

    emotion_instruction_map = {
        "happy": "用亲切、明亮、自然的语气讲解。",
        "enthusiastic": "用热情、轻快、有活力的语气讲解。",
        "curious": "用温和、好奇、引导式的语气讲解。",
        "gentle": "用温柔、舒缓、耐心的语气讲解。",
        "professional": "用清晰、稳重、专业的语气讲解。",
        "surprised": "用轻微惊喜但不夸张的语气讲解。",
    }
    return emotion_instruction_map.get((emotion or "").strip())


def _configure_dashscope_tts() -> None:
    dashscope.api_key = settings.DASHSCOPE_API_KEY
    if settings.DASHSCOPE_TTS_WS_URL:
        dashscope.base_websocket_api_url = settings.DASHSCOPE_TTS_WS_URL


def _synthesize_qwen_audio_tts(text: str, model: str, voice: str, instruction: str | None) -> bytes:
    from dashscope.audio.tts_v2 import SpeechSynthesizer

    _configure_dashscope_tts()
    kwargs = {"model": model, "voice": voice}
    if instruction:
        kwargs["instruction"] = instruction

    try:
        synthesizer = SpeechSynthesizer(**kwargs)
    except TypeError:
        if "instruction" not in kwargs:
            raise
        logger.warning("tts sdk does not accept instruction, retry without instruction")
        kwargs.pop("instruction", None)
        synthesizer = SpeechSynthesizer(**kwargs)

    audio = synthesizer.call(text)
    logger.info(
        "tts provider done request_id=%s first_package_delay_ms=%s audio_bytes=%s",
        getattr(synthesizer, "get_last_request_id", lambda: None)(),
        getattr(synthesizer, "get_first_package_delay", lambda: None)(),
        len(audio or b""),
    )
    if not audio:
        raise RuntimeError("Qwen-Audio TTS returned empty audio")
    return audio


async def synthesize_speech(text: str, voice_id: str = DEFAULT_QWEN_TTS_VOICE, emotion: str = None):
    """对接阿里云百炼 Qwen-Audio TTS，并返回 base64 和 duration。"""
    start = time.perf_counter()
    model = _resolve_tts_model()
    voice = _resolve_tts_voice(voice_id)
    instruction = _build_instruction(emotion)
    logger.info(
        "tts start model=%s voice_id=%s resolved_voice=%s emotion=%s instruction=%s text_chars=%s text_preview=%s timeout_seconds=%s ws_url_configured=%s",
        model,
        voice_id,
        voice,
        emotion,
        bool(instruction),
        len(text or ""),
        brief_text(text, 120),
        settings.TTS_TIMEOUT_SECONDS,
        bool(settings.DASHSCOPE_TTS_WS_URL),
    )
    try:
        audio_data = await asyncio.wait_for(
            asyncio.to_thread(
                _synthesize_qwen_audio_tts,
                text,
                model,
                voice,
                instruction,
            ),
            timeout=settings.TTS_TIMEOUT_SECONDS,
        )

        # 计算音频时长：WAV 可读头；MP3 等格式按文本长度估算。
        audio_size = len(audio_data)
        duration = 0
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
            "audio_data": audio_data,
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
        {
            "id": "longanhuan_v3.6",
            "name": "龙安欢",
            "gender": "female",
            "style": "Qwen-Audio 3.0 系统音色，适合自然、亲切的中文讲解",
        },
    ]
