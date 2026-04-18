"""
知识库查询API
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.knowledge_service import KnowledgeService
from app.agent.rag_service import rag_service

router = APIRouter()
# knowledge_service = KnowledgeService()
knowledge_service = rag_service  # 直接使用 RAG 服务作为知识查询接口

class SearchRequest(BaseModel):
    query: str
    top_k: int = 3

@router.post("/search")
async def search_knowledge(request: SearchRequest):
    """搜索知识库"""
    result = await knowledge_service.search(request.query, request.top_k)
    return {"result": result, "found": bool(result)}

@router.get("/categories")
async def get_categories():
    """获取知识类别"""
    return {
        "categories": [
            {"id": "history", "name": "历史沿革"},
            {"id": "culture", "name": "文化特色"},
            {"id": "route", "name": "游览路线"},
            {"id": "faq", "name": "常见问题"},
            {"id": "attraction", "name": "景点介绍"},
        ]
    }
