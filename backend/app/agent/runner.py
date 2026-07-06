"""
智能体运行器 - 对外统一接口

提供 run_agent() 函数，供 FastAPI 路由层调用。
封装 LangGraph 图的执行、状态初始化、结果提取。
"""
from __future__ import annotations

import asyncio
import time
from typing import Awaitable, Callable, Optional

from langchain_core.messages import HumanMessage

from app.core.config import settings
from app.core.logging import brief_text, elapsed_ms, get_logger
from app.agent.graph import get_agent_graph
from app.agent.state import AgentState
from app.agent.nodes import fallback_handler

logger = get_logger(__name__)


async def run_agent(
    user_input: str,
    session_id: str,
    history: list[dict],                   # [{"role": "user"/"assistant", "content": str}]
    image_base64: Optional[str] = None,
    image_mime_type: Optional[str] = None,
    location: Optional[str] = None,
    interests: Optional[str] = None,
    avatar_config: Optional[dict] = None,
    stream_callback: Optional[Callable[[str], Awaitable[None]]] = None,
) -> dict:
    """
    运行 LangGraph 导游智能体

    Args:
        user_input:      用户文本输入
        session_id:      会话 ID（用于日志追踪）
        history:         历史消息列表
        image_base64:    可选，base64 编码的图片
        image_mime_type: 图片 MIME 类型
        location:        游客当前位置
        interests:       游客兴趣标签（逗号分隔）
        avatar_config:   数字人配置（name, personality 等）

    Returns:
        {
            "reply": str,           # 最终回复文本
            "avatar_emotion": str,  # 数字人情感标签
            "visitor_emotion": dict,# 游客情感分析结果
            "knowledge_used": bool, # 是否使用了知识库
            "intent": str,          # 识别到的意图
            "agent_steps": list,    # 调试步骤记录
        }
    """
    start = time.perf_counter()
    logger.info(
        "agent start session_id=%s input_chars=%s history_count=%s has_image=%s location=%s interests=%s",
        session_id,
        len(user_input or ""),
        len(history or []),
        bool(image_base64),
        brief_text(location, 60),
        brief_text(interests, 80),
    )

    # 将历史转换为 LangChain Message 格式 
    lc_messages = []
    for h in history[-10:]:  # 最多保留10条
        role = h.get("role", "user")
        content = h.get("content", "")
        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        else:
            from langchain_core.messages import AIMessage
            lc_messages.append(AIMessage(content=content))

    # 加入当前用户输入
    lc_messages.append(HumanMessage(content=user_input))

    # 构建初始状态 
    initial_state: AgentState = {
        "messages":        lc_messages,
        "user_input":      user_input,
        "image_base64":    image_base64,
        "image_mime_type": image_mime_type or "image/jpeg",
        "retrieved_docs":  [],
        "intent":          "qa",
        "visitor_emotion": {},
        "final_reply":     "",
        "avatar_emotion":  "happy",
        "session_id":      session_id,
        "location":        location or "灵山胜境景区内",
        "interests":       interests or "未指定",
        "avatar_config":   avatar_config,
        "stream_callback": stream_callback,
        "agent_steps":     [],
    }

    logger.info(
        "agent state built session_id=%s lc_messages=%s avatar_config=%s",
        session_id,
        len(lc_messages),
        bool(avatar_config),
    )

    # 执行 LangGraph ───
    try:
        graph = get_agent_graph()
        final_state: AgentState = await asyncio.wait_for(
            graph.ainvoke(initial_state),
            timeout=settings.CHAT_AGENT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.exception(
            "agent timeout session_id=%s timeout_seconds=%s duration_ms=%s",
            session_id,
            settings.CHAT_AGENT_TIMEOUT_SECONDS,
            elapsed_ms(start),
        )
        fallback_state = await fallback_handler(initial_state)
        return {
            "reply":           fallback_state["final_reply"],
            "avatar_emotion":  fallback_state["avatar_emotion"],
            "visitor_emotion": {"emotion": "neutral", "sentiment_score": 0.5, "intensity": "low"},
            "knowledge_used":  False,
            "intent":          "qa",
            "agent_steps":     fallback_state["agent_steps"] + [
                f"[智能体超时] 超过 {settings.CHAT_AGENT_TIMEOUT_SECONDS:.0f}s，已返回兜底回复"
            ],
        }
    except Exception as e:
        # vLLM 不可用时降级到兜底处理
        logger.exception(
            "agent failed session_id=%s duration_ms=%s error=%s",
            session_id,
            elapsed_ms(start),
            e,
        )
        fallback_state = await fallback_handler(initial_state)
        return {
            "reply":           fallback_state["final_reply"],
            "avatar_emotion":  fallback_state["avatar_emotion"],
            "visitor_emotion": {"emotion": "neutral", "sentiment_score": 0.5, "intensity": "low"},
            "knowledge_used":  False,
            "intent":          "qa",
            "agent_steps":     fallback_state["agent_steps"],
        }

    # 提取结果 
    reply = final_state.get("final_reply", "抱歉，我暂时无法回答，请稍后再试。")
    result = {
        "reply":           final_state.get("final_reply", "抱歉，我暂时无法回答，请稍后再试。"),
        "avatar_emotion":  final_state.get("avatar_emotion", "gentle"),
        "visitor_emotion": final_state.get("visitor_emotion", {}),
        "knowledge_used":  len(final_state.get("retrieved_docs", [])) > 0,
        "intent":          final_state.get("intent", "qa"),
        "agent_steps":     final_state.get("agent_steps", []),
    }
    logger.info(
        "agent done session_id=%s intent=%s reply_chars=%s knowledge_used=%s steps=%s duration_ms=%s",
        session_id,
        result["intent"],
        len(reply or ""),
        result["knowledge_used"],
        len(result["agent_steps"]),
        elapsed_ms(start),
    )
    return result


async def analyze_conversations_report(conversations: list[dict]) -> dict:
    """
    批量分析对话记录，生成游客感受度报告
    使用 Qwen3 直接分析，无需走完整 Agent 图
    """
    from app.agent.qwen_client import qwen_client

    if not conversations:
        return {"overall_sentiment": "neutral", "satisfaction_score": 75}

    conv_text = "\n".join(
        [f"游客：{c['content']}" for c in conversations if c.get("role") == "user"]
    )[:3000]

    messages = [
        {
            "role": "system",
            "content": "你是景区运营数据分析师，只输出JSON，不输出其他内容。",
        },
        {
            "role": "user",
            "content": (
                f"分析以下游客对话，生成洞察报告，返回JSON：\n\n"
                f"对话内容：\n{conv_text}\n\n"
                "返回格式（仅JSON）：\n"
                "{\n"
                '  "overall_sentiment": "positive/neutral/negative",\n'
                '  "satisfaction_score": 0-100,\n'
                '  "top_concerns": ["关注点1","关注点2","关注点3"],\n'
                '  "top_interests": ["兴趣1","兴趣2","兴趣3"],\n'
                '  "suggestions": ["建议1","建议2"],\n'
                '  "emotion_breakdown": {"happy":0.4,"curious":0.3,"neutral":0.2,"confused":0.1}\n'
                "}"
            ),
        },
    ]

    try:
        result = await qwen_client.chat_json(messages, temperature=0.3, max_tokens=600)
        return result if result else {"overall_sentiment": "neutral", "satisfaction_score": 75}
    except Exception:
        return {"overall_sentiment": "neutral", "satisfaction_score": 75}
