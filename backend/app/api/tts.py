"""
语音合成API
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.tts_service import synthesize_speech, get_available_voices

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice_id: str = "zh-CN-XiaoxiaoNeural"
    emotion: str = "cheerful"

@router.post("/synthesize")
async def tts_synthesize(request: TTSRequest):
    """语音合成"""
    result = await synthesize_speech(
        text=request.text,
        voice_id=request.voice_id,
        emotion=request.emotion
    )
    return result

@router.get("/voices")
async def list_voices():
    """获取可用语音"""
    return {"voices": get_available_voices()}
