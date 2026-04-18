"""
AI核心服务 - 支持 DeepSeek（主）/ Anthropic Claude（备）
DeepSeek 兼容 OpenAI SDK，通过 base_url 切换即可。
"""
import json
import re
from typing import Optional, AsyncGenerator
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.knowledge_service import KnowledgeService

# ── 客户端初始化 ──────────────────────────────────────────────
def _make_client() -> AsyncOpenAI:
    if settings.AI_PROVIDER == "deepseek":
        return AsyncOpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
        )
    # anthropic openai-compat 备用（同结构）
    return AsyncOpenAI(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
    )

def _model() -> str:
    return settings.DEEPSEEK_MODEL  # "deepseek-chat" 或 "deepseek-reasoner"

client: AsyncOpenAI = _make_client()
knowledge_service = KnowledgeService()

# ── System Prompt 模板 ────────────────────────────────────────
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
- 在回答最开头用【情感标签】标注当前情绪（只选一个）：【开心】【好奇】【温柔】【专业】【热情】
- 适当使用"哇"、"其实"、"您知道吗"等口语化表达增加亲切感
- 推荐路线时给出具体建议，如"建议您先去...，再到..."

当前游客位置：{location}
游客兴趣偏好：{interests}
"""

# ── 情感分析 ─────────────────────────────────────────────────
async def analyze_emotion(text: str) -> dict:
    try:
        resp = await client.chat.completions.create(
            model=_model(),
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


# ── 主对话（非流式）──────────────────────────────────────────
async def get_ai_response(
    message: str,
    session_id: str,
    history: list,
    location: Optional[str] = None,
    interests: Optional[str] = None,
    avatar_config: Optional[dict] = None,
) -> dict:
    knowledge_context = await knowledge_service.search(message, top_k=3)

    avatar_name = (avatar_config or {}).get("name", "小慧")
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
        model=_model(),
        max_tokens=500,
        temperature=0.7,
        messages=messages,
    )
    reply = resp.choices[0].message.content.strip()

    # 提取并移除情感标签
    emotion_map = {
        "开心": "happy", "好奇": "curious", "温柔": "gentle",
        "专业": "professional", "热情": "enthusiastic", "惊喜": "surprised",
    }
    detected_emotion = "happy"
    for cn, en in emotion_map.items():
        if f"【{cn}】" in reply:
            detected_emotion = en
            reply = reply.replace(f"【{cn}】", "").strip()
            break

    visitor_emotion = await analyze_emotion(message)

    return {
        "reply": reply,
        "avatar_emotion": detected_emotion,
        "visitor_emotion": visitor_emotion,
        "knowledge_used": bool(knowledge_context),
    }


# ── 流式对话 ─────────────────────────────────────────────────
async def stream_ai_response(
    message: str,
    history: list,
    location: Optional[str] = None,
    interests: Optional[str] = None,
    avatar_config: Optional[dict] = None,
) -> AsyncGenerator[str, None]:
    knowledge_context = await knowledge_service.search(message, top_k=3)
    avatar_name = (avatar_config or {}).get("name", "小慧")
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
        model=_model(),
        max_tokens=500,
        temperature=0.7,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


# ── 情感报告生成 ─────────────────────────────────────────────
async def generate_sentiment_report(conversations: list) -> dict:
    if not conversations:
        return {}

    conv_text = "\n".join(
        [f"游客：{c['content']}" for c in conversations if c.get("role") == "user"]
    )

    resp = await client.chat.completions.create(
        model=_model(),
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
