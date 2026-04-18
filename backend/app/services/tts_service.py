"""
语音合成服务 - 支持 edge-tts 和 OpenAI TTS
TODO 待修改为国内 TTS 服务
"""
import asyncio
import contextlib
import os
import io
import uuid
import base64
from typing import Optional
import wave

import httpx
from app.core.config import settings
import dashscope

async def synthesize_speech(text: str, voice_id: str = "Cherry", emotion: str = None):
    """
    兼容原有的 synthesize_speech 调用方式
    对接阿里云 Qwen-TTS 并返回 base64 和 duration
    """
    # 转换 emotion（可选）：如果你的系统有情绪映射，可以在此处理
    # qwen-tts-instruct-flash 支持指令控制情绪
    
    try:
        # 1. 调用阿里云接口 
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

        # 2. 异步下载音频数据
        async with httpx.AsyncClient() as client:
            resp = await client.get(audio_url)
            resp.raise_for_status()
            audio_data = resp.content

        # 3. 计算音频时长 (WAV 格式)
        # 通过 wave 库读取字节流信息
        duration = 0
        with contextlib.closing(wave.open(io.BytesIO(audio_data), 'rb')) as f:
            frames = f.getnframes()
            rate = f.getframerate()
            duration = frames / float(rate)

        # 4. 转为 Base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        return {
            "audio_base64": audio_base64,
            "duration": duration,
            "url": audio_url  # 额外保留 URL 备用
        }

    except Exception as e:
        print(f"❌ TTS 兼容层异常: {e}")
        return {"audio_base64": None, "duration": 0}



async def _edge_tts_synthesize(text: str, voice_id: str, emotion: str) -> dict:
    """使用edge-tts合成（免费，无需API key）"""
    import edge_tts
    
    # 情感映射到edge-tts风格
    style_map = {
        "happy": "cheerful",
        "enthusiastic": "excited", 
        "gentle": "gentle",
        "professional": "newscast",
        "curious": "friendly-chat",
        "sad": "empathetic"
    }
    
    # edge-tts语音列表（中文）
    voice_options = {
        "Cherry": "Cherry",  # 女声，温柔
        "zh-CN-YunxiNeural": "zh-CN-YunxiNeural",         # 男声
        "zh-CN-XiaohanNeural": "zh-CN-XiaohanNeural",    # 女声，活泼
        "zh-CN-YunjianNeural": "zh-CN-YunjianNeural",     # 男声，磁性
    }
    
    voice = voice_options.get(voice_id, "Cherry")
    
    # 生成临时文件
    temp_file = f"/tmp/tts_{uuid.uuid4().hex}.mp3"
    
    communicate = edge_tts.Communicate(text, voice, rate="+5%", pitch="+2Hz")
    await communicate.save(temp_file)
    
    # 读取并转换为base64
    with open(temp_file, "rb") as f:
        audio_data = f.read()
    
    # 清理临时文件
    os.remove(temp_file)
    
    audio_base64 = base64.b64encode(audio_data).decode("utf-8")
    
    # 估算时长（粗略：中文每分钟约200字）
    duration = len(text) / 200 * 60
    
    return {
        "audio_base64": audio_base64,
        "duration": duration,
        "format": "mp3",
        "voice": voice
    }

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
