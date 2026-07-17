"""
AI核心服务 - DashScope API (OpenAI 兼容接口)
"""
import json
import re
from typing import Optional, AsyncGenerator
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.knowledge_service import KnowledgeService

knowledge_service = KnowledgeService()

client = AsyncOpenAI(
    api_key=settings.DASHSCOPE_API_KEY,
    base_url=settings.DASHSCOPE_BASE_URL,
)

_MODEL = settings.QWEN_MODEL  # qwen-plus

# ── System Prompt 模板 ─
SYSTEM_PROMPT_TEMPLATE = """你是{avatar_name}，{scenic_name}的AI数字人导游。你具备以下特质：
{personality}

你的职责：
1. 用热情、专业、亲切的方式介绍景区历史、文化、景点特色
2. 根据游客兴趣推荐个性化游览路线
3. 准确回答景区相关问题，不确定时诚实告知
4. 关注游客情绪，适时调整交流风格

景区知识库信息（参考使用）：
{knowledge_context}

回答要求：
- 语言自然流畅，口语化，适合语音播放
- 每次回答控制在150字以内，除非游客要求详细介绍
- 【重要】每条回复必须且至少包含两个[emotion]标签！标签必须放在回复文本的开头或情绪转换处
  可用标签： [happy] [anger] [sad] [surprise] [love] [confused] [shy] [proud] [neutral]
  示例："[happy]哇！这个景点太美了，您知道吗它有一千多年历史了。"
  错误示例（缺少标签，不允许）："这个景点很美，有一千多年历史。"
  不要连续重复使用同一个标签
- 适当使用"哇"、"其实"、"您知道吗"等口语化表达增加亲切感
- 推荐路线时给出具体建议，如"建议您先去...，再到..."

当前游客位置：{location}
游客兴趣偏好：{interests}
"""


# ── 情感分析 ─
async def analyze_emotion(text: str) -> dict:
    try:
        resp = await client.chat.completions.create(
            model=_MODEL,
            max_tokens=200,
            temperature=0.0,
            messages=[
                {"role": "system", "content": "你是情感分析专家，只输出JSON，不输出其他内容。"},
                {"role": "user", "content": (
                    f"分析以下游客消息的情感，返回JSON：\n消息：{text}\n\n"
                    '返回格式（仅JSON）：\n'
                    '{"emotion": "happy/curious/neutral/satisfied/confused/disappointed", '
                    '"sentiment_score": 0.0-1.0, "intensity": "low/medium/high"}'
                )}
            ]
        )
        raw = resp.choices[0].message.content.strip()
        raw = re.sub(r"^```json\s*|```$", "", raw, flags=re.MULTILINE).strip()
        return json.loads(raw)
    except Exception:
        return {"emotion": "neutral", "sentiment_score": 0.5, "intensity": "low"}


# ── 主对话（非流式）─
async def get_ai_response(
    message: str,
    session_id: str,
    history: list,
    location: Optional[str] = None,
    interests: Optional[str] = None,
    avatar_config: Optional[dict] = None,
) -> dict:
    knowledge_context = await knowledge_service.search(message, top_k=3)

    avatar_name = (avatar_config or {}).get("name", "Lingxi")
    personality  = (avatar_config or {}).get("personality", "热情友善、知识渊博、善于沟通")
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        avatar_name=avatar_name,
        scenic_name="智慧景区",
        personality=personality,
        knowledge_context=knowledge_context or "（暂无相关知识库内容，请根据通用知识回答）",
        location=location or "未知",
        interests=interests or "未指定",
    )

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    resp = await client.chat.completions.create(
        model=_MODEL,
        max_tokens=500,
        temperature=0.7,
        messages=messages,
    )
    reply = resp.choices[0].message.content.strip()

    # 从 [emotion] 标签提取 avatar_emotion（保留标签在文本中供前端解析）
    import re as regex
    tag_to_emotion = {
        "happy": "happy", "anger": "enthusiastic", "sad": "gentle",
        "surprise": "surprised", "love": "happy", "playful": "enthusiastic",
        "confused": "curious", "shy": "gentle", "proud": "professional",
        "neutral": "gentle",
    }
    detected_emotion = "happy"
    found_tags = regex.findall(r"\[(\w+)\]", reply)
    if found_tags:
        first_tag = found_tags[0].lower()
        detected_emotion = tag_to_emotion.get(first_tag, "happy")
    else:
        # 兜底：AI 没加标签时，根据回复内容自动插入
        emotion_to_tag = {"happy": "happy", "enthusiastic": "happy", "curious": "confused",
                          "gentle": "neutral", "professional": "neutral", "surprised": "surprise"}
        fallback_tag = emotion_to_tag.get(detected_emotion, "happy")
        reply = f"[{fallback_tag}] {reply}"
        found_tags = [fallback_tag]

    visitor_emotion = await analyze_emotion(message)

    return {
        "reply": reply,
        "avatar_emotion": detected_emotion,
        "visitor_emotion": visitor_emotion,
        "knowledge_used": bool(knowledge_context),
    }


# ── 流式对话 ─
async def stream_ai_response(
    message: str,
    history: list,
    location: Optional[str] = None,
    interests: Optional[str] = None,
    avatar_config: Optional[dict] = None,
) -> AsyncGenerator[str, None]:
    knowledge_context = await knowledge_service.search(message, top_k=3)
    avatar_name = (avatar_config or {}).get("name", "Lingxi")
    personality  = (avatar_config or {}).get("personality", "热情友善、知识渊博")
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        avatar_name=avatar_name,
        scenic_name="智慧景区",
        personality=personality,
        knowledge_context=knowledge_context or "（请根据通用知识回答）",
        location=location or "未知",
        interests=interests or "未指定",
    )

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-8:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    stream = await client.chat.completions.create(
        model=_MODEL,
        max_tokens=500,
        temperature=0.7,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


# ── 情感报告生成 ─
async def generate_sentiment_report(conversations: list) -> dict:
    if not conversations:
        return {}

    conv_text = "\n".join(
        [f"游客：{c['content']}" for c in conversations if c.get("role") == "user"]
    )

    resp = await client.chat.completions.create(
        model=_MODEL,
        max_tokens=1000,
        temperature=0.3,
        messages=[
            {"role": "system", "content": "你是景区运营数据分析师，只输出JSON，不输出其他内容。"},
            {"role": "user", "content": (
                f"分析以下游客对话，生成洞察报告，返回JSON：\n\n"
                f"对话内容：\n{conv_text[:3000]}\n\n"
                "返回格式（仅JSON）：\n"
                '{\n'
                '  "overall_sentiment": "positive/neutral/negative",\n'
                '  "satisfaction_score": 0-100,\n'
                '  "top_concerns": ["关注点1", "关注点2", "关注点3"],\n'
                '  "top_interests": ["兴趣1", "兴趣2", "兴趣3"],\n'
                '  "suggestions": ["建议1", "建议2"],\n'
                '  "emotion_breakdown": {"happy": 0.4, "curious": 0.3, "neutral": 0.2, "confused": 0.1}\n'
                '}'
            )}
        ]
    )

    raw = resp.choices[0].message.content.strip()
    raw = re.sub(r"^```json\s*|```$", "", raw, flags=re.MULTILINE).strip()
    try:
        return json.loads(raw)
    except Exception:
        return {"overall_sentiment": "neutral", "satisfaction_score": 75}
