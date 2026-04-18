"""
语音合成服务 - 支持edge-tts（免费）和OpenAI TTS
TODO 待修改为国内 TTS 服务
"""
import asyncio
import os
import uuid
import base64
from typing import Optional
from app.core.config import settings

async def synthesize_speech(
    text: str,
    voice_id: str = "zh-CN-XiaoxiaoNeural",
    emotion: str = "cheerful",
    output_format: str = "base64"
) -> dict:
    """
    语音合成
    Returns: {"audio_base64": str, "duration": float, "format": "mp3"}
    """
    # 清理文本（移除情感标签等特殊字符）
    import re
    text = re.sub(r'【.*?】', '', text).strip()
    text = re.sub(r'\*+', '', text).strip()
    
    if not text:
        return {"audio_base64": "", "duration": 0}
    
    try:
        return await _edge_tts_synthesize(text, voice_id, emotion)
    except Exception as e:
        print(f"TTS合成失败: {e}")
        return {"audio_base64": "", "duration": 0, "error": str(e)}

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
        "zh-CN-XiaoxiaoNeural": "zh-CN-XiaoxiaoNeural",  # 女声，温柔
        "zh-CN-YunxiNeural": "zh-CN-YunxiNeural",         # 男声
        "zh-CN-XiaohanNeural": "zh-CN-XiaohanNeural",    # 女声，活泼
        "zh-CN-YunjianNeural": "zh-CN-YunjianNeural",     # 男声，磁性
    }
    
    voice = voice_options.get(voice_id, "zh-CN-XiaoxiaoNeural")
    
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
        {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓", "gender": "female", "style": "温柔亲切"},
        {"id": "zh-CN-XiaohanNeural", "name": "晓涵", "gender": "female", "style": "活泼开朗"},
        {"id": "zh-CN-XiaomoNeural", "name": "晓默", "gender": "female", "style": "轻松自然"},
        {"id": "zh-CN-YunxiNeural", "name": "云希", "gender": "male", "style": "阳光活力"},
        {"id": "zh-CN-YunjianNeural", "name": "云健", "gender": "male", "style": "磁性稳重"},
        {"id": "zh-CN-YunyangNeural", "name": "云扬", "gender": "male", "style": "专业播报"},
    ]
