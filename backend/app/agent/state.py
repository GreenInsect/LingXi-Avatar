"""
LangGraph 智能体状态定义

所有节点共享同一个 AgentState，通过 TypedDict 严格类型化，
"""
from __future__ import annotations

import operator
from typing import Annotated, Any, Optional
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage


class AgentState(TypedDict):
    """导游智能体完整状态"""

    #  对话消息列表（LangGraph 自动追加）
    messages: Annotated[list[BaseMessage], operator.add]

    #  用户当前输入 
    user_input: str

    #  图片（base64 编码，可选）
    image_base64: Optional[str]
    image_mime_type: Optional[str]   # "image/jpeg" / "image/png" 等

    #  RAG 检索到的知识片段 
    retrieved_docs: list[dict]       # [{"title": str, "content": str, "score": float}]

    #  意图路由结果 
    intent: str                      # "qa" / "route" / "image" / "emotion" / "chitchat"

    #  情感分析结果 
    visitor_emotion: dict            # {"emotion": str, "sentiment_score": float, "intensity": str}

    #  最终生成的回复 
    final_reply: str

    #  数字人情感（驱动表情动画）
    avatar_emotion: str              # "happy"/"curious"/"gentle"/"professional"/"enthusiastic"

    #  元信息 
    session_id: str
    location: Optional[str]
    interests: Optional[str]
    avatar_config: Optional[dict]

    #  调试/追踪信息 
    agent_steps: Annotated[list[str], operator.add]  # 记录每步操作，方便调试
