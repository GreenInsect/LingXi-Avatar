"""
语音合成服务 - 阿里云 DashScope Qwen-TTS
"""
import io
import base64
import contextlib
import wave

import httpx
import dashscope
from app.core.config import settings


async def synthesize_speech(text: str, voice_id: str = "Cherry", emotion: str = None):
    """对接阿里云 Qwen-TTS 并返回 base64 和 duration"""
    try:
        response = dashscope.MultiModalConversation.call(
            model="qwen3-tts-flash",
            text=text,
            voice=voice_id,
            api_key=settings.DASHSCOPE_API_KEY,
        )

        if response.status_code != 200:
            print(f"❌ 阿里云 TTS 失败: {response.message}")
            return {"audio_base64": None, "duration": 0}

        audio_url = response.output.audio.url

        async with httpx.AsyncClient() as client:
            resp = await client.get(audio_url)
            resp.raise_for_status()
            audio_data = resp.content

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
            except Exception:
                pass
        if duration <= 0:
            duration = len(text) / 4.0  # 中文约4字/秒

        audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        return {
            "audio_base64": audio_base64,
            "duration": duration,
            "audio_data": audio_data,  # 原始 WAV 字节，供 ML 嘴型模型
        }

    except Exception as e:
        print(f"❌ TTS 异常: {e}")
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
