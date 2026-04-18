"""
LangGraph 智能体节点定义

节点列表：
  1. intent_classifier   - 意图识别（路由决策）
  2. rag_retriever       - RAG 知识检索
  3. image_analyzer      - 图像理解（Qwen-VL）
  4. emotion_analyzer    - 游客情感分析
  5. response_generator  - 最终回复生成（融合 RAG + 上下文）
  6. fallback_handler    - 兜底处理（模型不可用时）
TODO Chat 流式输出
TODO 多模态输入处理（如同时有文本和图片时的融合策略）
TODO 个性化定制（根据用户画像调整回复风格和内容）
TODO Tools 集成（如天气查询、地图导航等实用工具）
"""
from __future__ import annotations

import re
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.agent.state import AgentState
from app.agent.qwen_client import qwen_client
from app.agent.rag_service import rag_service

# 导游人设 System Prompt 
GUIDE_SYSTEM = """你是灵山胜境的AI数字人导游"小慧"，性格热情友善、知识渊博、善于沟通。

你的职责：
1. 用热情、专业、亲切的方式介绍灵山胜境的历史、文化、景点特色
2. 根据游客兴趣推荐个性化游览路线（历史文化线/自然风光线/亲子家庭线）
3. 准确回答关于景区的问题，不确定时诚实告知
4. 关注游客情绪，适时调整交流风格

回答规范：
- 语言自然流畅，口语化，适合语音播放，每次回答控制在200字以内
- 在回答最开头用【情感标签】标注当前情绪（仅选其一）：【开心】【好奇】【温柔】【专业】【热情】
- 适当使用"您知道吗"、"其实"、"哇"等口语化表达增加亲切感
- 推荐路线时给出具体建议，如"建议您先去...，再到..."
- 图像分析时结合景区知识给出专业解读"""


# 1. 意图识别节点 
async def intent_classifier(state: AgentState) -> dict:
    """
    识别用户意图，决定后续路由：
    - qa:       景区知识问答（景点/历史/文化/路线/门票等）
    TODO 关于路线, 以后可以尝试开发这样的模块，约束与得到大模型格式化输出, 配合前端动态生成可视化路线
    - route:    明确要求推荐路线
    - image:    用户上传了图片（触发 VL 模型）
    - emotion:  情绪表达/投诉/建议
    - chitchat: 闲聊/无关话题
    """
    user_input = state["user_input"]
    has_image = bool(state.get("image_base64"))

    # 有图片直接路由到 image
    if has_image:
        return {
            "intent": "image",
            "agent_steps": [f"[意图识别] 检测到图片输入，路由至图像分析节点"],
        }

    prompt_messages = [
        {
            "role": "system",
            "content": (
                "你是意图分类器，只输出JSON，不输出其他内容。\n"
                "将用户消息分类为以下意图之一：\n"
                "- qa: 询问景区相关知识（景点、历史、文化、门票、时间、餐饮、路线等）\n"
                "- route: 明确要求推荐游览路线或行程安排\n"
                "- image: 描述或询问图片相关内容\n"
                "- emotion: 情绪表达、投诉、建议、赞美\n"
                "- chitchat: 闲聊、问候、无关话题\n"
                "confidence 表示你对分类的确定程度，越确定越接近1，不确定时低于0.6\n"
                '返回格式：{"intent": "qa/route/image/emotion/chitchat", "confidence": 0.0-1.0}'
            ),
        },
        {"role": "user", "content": f"用户消息：{user_input}"},
    ]

    result = await qwen_client.chat_json(prompt_messages, temperature=0.0, max_tokens=100)
    intent = result.get("intent", "qa")
    confidence = result.get("confidence", 0.8)

    return {
        "intent": intent,
        "agent_steps": [f"[意图识别] intent={intent}, confidence={confidence:.0%}"],
    }


# 2. RAG 检索节点 
async def rag_retriever(state: AgentState) -> dict:
    """
    使用 Qwen Embedding 进行语义相似度检索
    """
    query = state["user_input"]
    # 若有历史上下文，拼接最近一轮提升检索质量
    messages = state.get("messages", [])
    if messages:
        last_human = next((m for m in reversed(messages) if isinstance(m, HumanMessage)), None)
        if last_human and last_human.content != query:
            query = f"{last_human.content} {query}"
    # TODO RAG 模块待完善
    docs = await rag_service.search(query, top_k=4)

    return {
        "retrieved_docs": docs,
        "agent_steps": [
            f"[RAG检索] 查询='{state['user_input'][:30]}...', "
            f"命中{len(docs)}篇文档, "
            f"最高相关度={docs[0]['score']:.0%}" if docs else "[RAG检索] 未命中文档"
        ],
    }


# 3. 图像分析节点（Qwen-VL）
async def image_analyzer(state: AgentState) -> dict:
    """
    使用 Qwen3-VL 分析用户上传的图片：
    - 识别景点/建筑/佛像
    - 结合景区知识库给出专业介绍
    - 提供参观建议
    """
    image_b64 = state.get("image_base64", "")
    user_input = state.get("user_input", "请帮我介绍这张图片中的景点")

    # 先用 RAG 检索相关知识作为辅助上下文
    rag_docs = await rag_service.search("灵山大佛 梵宫 佛像 景点建筑", top_k=3)
    knowledge_hint = rag_service.format_context(rag_docs, max_chars=800)

    vl_prompt = (
        f"你是灵山胜境的专业导游小慧。请根据图片内容，结合以下景区知识，"
        f"为游客提供专业、亲切的介绍和参观建议。\n\n"
        f"景区参考知识：\n{knowledge_hint}\n\n"
        f"游客问题：{user_input}\n\n"
        f"请识别图片中的景点/建筑/佛像，说明其历史文化意义，并给出参观小贴士。"
        f"回答控制在150字以内，语言亲切自然。"
        f"回答开头加【情感标签】：【开心】【好奇】【专业】中选一个。"
    )

    try:
        vl_reply = await qwen_client.vision_chat(
            text_prompt=vl_prompt,
            image_base64=image_b64,
            temperature=0.5,
            max_tokens=300,
        )
        # 提取情感标签
        emotion = _extract_emotion(vl_reply)
        reply = _strip_emotion_tag(vl_reply)

        return {
            "final_reply": reply,
            "avatar_emotion": emotion,
            "retrieved_docs": rag_docs,
            "agent_steps": ["[图像分析] Qwen-VL 完成图像识别与景点解读"],
        }
    except Exception as e:
        error_msg = f"图片分析服务暂时不可用（{str(e)[:50]}），请用文字描述您想了解的景点，我来为您介绍～"
        return {
            "final_reply": error_msg,
            "avatar_emotion": "gentle",
            "retrieved_docs": [],
            "agent_steps": [f"[图像分析] Qwen-VL 调用失败: {e}"],
        }


# 4. 情感分析节点 
async def emotion_analyzer(state: AgentState) -> dict:
    """分析游客消息的情感倾向，用于数字人表情调整和管理后台报告"""
    user_input = state["user_input"]

    prompt_messages = [
        {
            "role": "system",
            "content": (
                "你是情感分析专家，分析游客消息的情感，只输出JSON，不输出其他内容。\n"
                '返回格式：{"emotion":"happy/curious/neutral/satisfied/confused/disappointed",'
                '"sentiment_score":0.0-1.0,"intensity":"low/medium/high"}'
            ),
        },
        {"role": "user", "content": f"游客消息：{user_input}"},
    ]

    result = await qwen_client.chat_json(prompt_messages, temperature=0.0, max_tokens=100)

    if not result:
        result = {"emotion": "neutral", "sentiment_score": 0.6, "intensity": "low"}

    return {
        "visitor_emotion": result,
        "agent_steps": [
            f"[情感分析] emotion={result.get('emotion')}, "
            f"score={result.get('sentiment_score', 0):.0%}"
        ],
    }


# 5. 回复生成节点 
async def response_generator(state: AgentState) -> dict:
    """
    融合 RAG 知识、对话历史、用户意图，生成最终回复。
    根据意图调整生成策略：
    - qa/route: RAG 增强生成
    - emotion:  共情优先
    - chitchat: 轻松友好
    """
    intent = state.get("intent", "qa")
    user_input = state["user_input"]
    retrieved_docs = state.get("retrieved_docs", [])
    avatar_config = state.get("avatar_config") or {}

    avatar_name = avatar_config.get("name", "小慧")
    personality = avatar_config.get("personality", "热情友善、知识渊博、善于沟通")
    location = state.get("location", "景区内")
    interests = state.get("interests", "未指定")

    # 构建知识上下文
    knowledge_context = rag_service.format_context(retrieved_docs, max_chars=1500)

    # 意图专属指令
    intent_instructions = {
        "qa": "请基于景区知识库内容准确回答游客问题，引用具体数据（时间、票价、高度等）增强可信度。",
        "route": "请根据游客兴趣推荐最合适的游览路线，给出具体的景点顺序、参观时长和实用贴士。",
        "emotion": "游客可能有情绪表达，请先共情回应，再提供有帮助的信息。",
        "chitchat": "保持友好轻松的对话氛围，适当引导话题到景区介绍上。",
    }
    instruction = intent_instructions.get(intent, intent_instructions["qa"])

    # 构建对话历史（最近5轮）
    history_messages = []
    for msg in state.get("messages", [])[-10:]:
        if isinstance(msg, HumanMessage):
            history_messages.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage):
            history_messages.append({"role": "assistant", "content": msg.content})

    system_content = (
        f"{GUIDE_SYSTEM}\n\n"
        f"【导游配置】姓名：{avatar_name}，性格：{personality}\n"
        f"【游客位置】{location}\n"
        f"【游客兴趣】{interests}\n\n"
        f"【景区知识库】\n{knowledge_context}\n\n"
        f"【当前意图】{intent} - {instruction}"
    )

    messages = [{"role": "system", "content": system_content}]
    messages.extend(history_messages)
    messages.append({"role": "user", "content": user_input})

    try:
        reply = await qwen_client.chat(messages, temperature=0.7, max_tokens=400)
    except Exception as e:
        reply = f"【温柔】非常抱歉，我暂时遇到了一些技术问题 😊 您可以稍后再试，或者直接前往景区服务中心，工作人员会热情为您服务的！"
        return {
            "final_reply": _strip_emotion_tag(reply),
            "avatar_emotion": "gentle",
            "agent_steps": [f"[回复生成] 模型调用失败: {e}，使用兜底回复"],
        }

    emotion = _extract_emotion(reply)
    clean_reply = _strip_emotion_tag(reply)

    return {
        "final_reply": clean_reply,
        "avatar_emotion": emotion,
        "messages": [AIMessage(content=clean_reply)],
        "agent_steps": [
            f"[回复生成] intent={intent}, 字符数={len(clean_reply)}, "
            f"avatar_emotion={emotion}, RAG文档数={len(retrieved_docs)}"
        ],
    }


# 6. 兜底处理节点 
async def fallback_handler(state: AgentState) -> dict:
    """当 vLLM 服务不可用时的兜底响应"""
    return {
        "final_reply": (
            "您好！目前AI服务正在维护中，请稍候片刻。\n"
            "灵山胜境景区信息：成人票210元，开放时间08:00-18:00（夏季），"
            "九龙灌浴表演：10:00/11:30/13:30/15:00，梵宫演出：10:35/11:30/14:00/16:00。"
        ),
        "avatar_emotion": "gentle",
        "agent_steps": ["[兜底处理] vLLM 服务不可用，返回静态信息"],
    }


# 工具函数 
def _extract_emotion(text: str) -> str:
    """从回复文本中提取情感标签"""
    emotion_map = {
        "开心": "happy", "好奇": "curious", "温柔": "gentle",
        "专业": "professional", "热情": "enthusiastic", "惊喜": "surprised",
    }
    for cn, en in emotion_map.items():
        if f"【{cn}】" in text:
            return en
    return "happy"


def _strip_emotion_tag(text: str) -> str:
    """移除情感标签，返回干净的回复文本"""
    return re.sub(r"【(开心|好奇|温柔|专业|热情|惊喜)】\s*", "", text).strip()
