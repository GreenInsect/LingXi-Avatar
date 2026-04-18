"""
LangGraph 智能体图定义

图结构（DAG）：
                    ┌─────────────────┐
                    │  START          │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ intent_classifier│  ← 意图识别（路由决策）
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │ 
    ┌─────────▼──────┐  ┌───▼──────┐  ┌───▼──────────┐
    │ rag_retriever  │  │ image_   │  │ (直接跳到     │
    │ (qa/route/     │  │ analyzer │  │  response_    │
    │  emotion/      │  │          │  │  generator)   │
    │  chitchat)     │  └───┬──────┘  │  emotion/     │
    └─────────┬──────┘      │         │  chitchat     │
              │              │         └───┬──────────┘
    ┌─────────▼──────┐  ┌───▼──────┐      │
    │ emotion_       │  │(已完成，  │      │
    │ analyzer       │  │ 直接END)  │      │
    └─────────┬──────┘  └──────────┘      │
              │                            │
    ┌─────────▼──────────────────────┐     │
    │      response_generator        │◄────┘
    └─────────┬──────────────────────┘
              │
           ┌──▼──┐
           │ END │
           └─────┘
"""
from __future__ import annotations

from typing import Literal

from langgraph.graph import StateGraph, START, END

from app.agent.state import AgentState
from app.agent.nodes import (
    intent_classifier,
    rag_retriever,
    image_analyzer,
    emotion_analyzer,
    response_generator,
    fallback_handler,
)


# 路由函数 TODO 青春版 待完善更复杂的路由逻辑（如基于用户画像、会话上下文等多维度决策）
def route_by_intent(state: AgentState) -> Literal[
    "rag_retriever", "image_analyzer", "response_generator"
]:
    """
    根据意图识别结果决定下一步节点：
    - image  → 图像分析（直接生成回复）
    - qa/route → RAG 检索 → 情感分析 → 回复生成
    - emotion/chitchat → 跳过 RAG，直接回复生成
    """
    intent = state.get("intent", "qa")
    if intent == "image":
        return "image_analyzer"
    elif intent in ("qa", "route"):
        return "rag_retriever"
    else:
        # emotion / chitchat：不需要 RAG，直接生成
        return "response_generator"


def route_after_image(state: AgentState) -> Literal["end"]:
    """图像分析节点完成后直接结束（final_reply 已设置）"""
    return "end"


def route_after_rag(state: AgentState) -> Literal["emotion_analyzer"]:
    """RAG 检索完成后，进行情感分析"""
    return "emotion_analyzer"


# 构建图
def build_agent_graph() -> StateGraph:
    """构建并返回编译后的 LangGraph 智能体"""

    graph = StateGraph(AgentState)

    # 注册所有节点
    graph.add_node("intent_classifier", intent_classifier)
    graph.add_node("rag_retriever", rag_retriever)
    graph.add_node("image_analyzer", image_analyzer)
    graph.add_node("emotion_analyzer", emotion_analyzer)
    graph.add_node("response_generator", response_generator)
    graph.add_node("fallback_handler", fallback_handler)

    # 入口
    graph.add_edge(START, "intent_classifier")

    # 意图分发（条件路由）
    graph.add_conditional_edges(
        "intent_classifier",
        route_by_intent,
        {
            "image_analyzer": "image_analyzer",
            "rag_retriever": "rag_retriever",
            "response_generator": "response_generator",
        },
    )

    # 图像分析完成 → 结束
    graph.add_edge("image_analyzer", END)

    # RAG → 情感分析 → 回复生成 → 结束
    graph.add_edge("rag_retriever", "emotion_analyzer")
    graph.add_edge("emotion_analyzer", "response_generator")
    graph.add_edge("response_generator", END)

    # 兜底节点
    graph.add_edge("fallback_handler", END)

    return graph.compile()


# 全局编译好的图实例 
_agent_graph = None


def get_agent_graph():
    # 图是全局只创建一次, 每次请求只是用新的 state 去跑这张图
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = build_agent_graph()
    return _agent_graph
