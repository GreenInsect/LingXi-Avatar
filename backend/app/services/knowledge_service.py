"""
知识库服务 - 基于ChromaDB的RAG检索
"""
import os
import json
from typing import Optional
from app.core.config import settings

# 景区默认知识库（内置示例数据）
DEFAULT_KNOWLEDGE = [
    {
        "id": "hist_001",
        "category": "history",
        "title": "景区历史沿革",
        "content": """本景区建于明朝中期，距今已有600余年历史。明朝洪武年间，这里是皇家园林的重要组成部分。
        清朝乾隆年间进行了大规模扩建，形成了如今的规模。近代以来，景区经历了多次修缮和保护性开发，
        于1995年被列为国家4A级旅游景区，2010年升级为5A级景区。景区内保存有完整的明清建筑群，
        是研究明清园林艺术的重要实物资料。"""
    },
    {
        "id": "culture_001", 
        "category": "culture",
        "title": "文化特色",
        "content": """景区以中国传统园林文化为核心，融合了儒释道三家思想精髓。
        园中设有书法碑廊，刻有历代文人墨客的诗词书法作品，具有极高的艺术价值。
        每年举办的传统文化节庆活动吸引大量游客参与，包括花朝节、中秋赏月、重阳登高等。
        非物质文化遗产传承人定期在景区内开展传统技艺展示，让游客零距离体验传统文化魅力。"""
    },
    {
        "id": "route_history",
        "category": "route",
        "title": "历史文化路线",
        "content": """历史文化路线（约3小时）：
        1. 东门入口 → 2. 明代碑廊（20分钟，欣赏历代书法精品）
        3. 清晖阁（30分钟，了解园林建筑艺术）→ 4. 文史展览馆（40分钟，系统了解景区历史）
        5. 御花园（30分钟，感受皇家园林风韵）→ 6. 传统技艺展示区（20分钟，体验非遗文化）
        适合对历史文化感兴趣的游客，建议上午游览，光线好，拍照效果佳。"""
    },
    {
        "id": "route_nature",
        "category": "route",
        "title": "自然生态路线",
        "content": """自然生态路线（约2.5小时）：
        1. 西门入口 → 2. 百花苑（30分钟，四季花卉欣赏）
        3. 竹林小径（20分钟，清幽竹海漫步）→ 4. 荷花池（30分钟，夏日必打卡）
        5. 鸟语林（20分钟，百鸟园区）→ 6. 山顶观景台（30分钟，俯瞰全景）
        适合喜欢自然风光、摄影爱好者，推荐早晨或傍晚光线最美时段。"""
    },
    {
        "id": "faq_001",
        "category": "faq",
        "title": "常见问题",
        "content": """开放时间：夏季（4月-10月）8:00-18:00，冬季（11月-3月）8:30-17:00
        门票价格：成人80元，学生/老人40元，儿童（1.2米以下）免费
        停车场：东门停车场可停500辆，西门停车场可停300辆，均免费
        餐饮：园内有3处餐厅，提供中式简餐，价格30-80元/人
        特色纪念品：手工刺绣、景泰蓝摆件、传统木版年画等
        禁止事项：禁止携带宠物入园，禁止在园内使用无人机"""
    },
    {
        "id": "spot_001",
        "category": "attraction",
        "title": "核心景点介绍",
        "content": """清晖阁：建于清乾隆年间，三层木构楼阁，是园内制高点，可俯瞰全园美景。
        内藏珍贵文物200余件，包括乾隆御笔题字和明代瓷器精品。
        
        荷花池：面积3000平方米，每年6-8月荷花盛开，是摄影爱好者的天堂。
        池边有明代石桥两座，桥身雕刻精美，具有极高艺术价值。
        
        百花苑：种植各类名贵花卉500余种，一年四季花开不断。
        春季牡丹、樱花最为壮观，吸引大量游客前来赏花。"""
    }
]

class KnowledgeService:
    def __init__(self):
        self.use_chroma = False
        self.knowledge_base = DEFAULT_KNOWLEDGE
        self._try_init_chroma()
    
    def _try_init_chroma(self):
        """尝试初始化ChromaDB向量数据库"""
        try:
            import chromadb
            from chromadb.utils import embedding_functions
            
            os.makedirs(settings.CHROMA_DB_DIR, exist_ok=True)
            self.chroma_client = chromadb.PersistentClient(path=settings.CHROMA_DB_DIR)
            
            # 使用默认嵌入函数
            self.collection = self.chroma_client.get_or_create_collection(
                name="scenic_knowledge",
                metadata={"hnsw:space": "cosine"}
            )
            
            # 如果集合为空，添加默认知识
            if self.collection.count() == 0:
                self._index_default_knowledge()
            
            self.use_chroma = True
            print("✅ ChromaDB向量数据库初始化成功")
        except Exception as e:
            print(f"⚠️  ChromaDB不可用，使用关键词检索: {e}")
    
    def _index_default_knowledge(self):
        """索引默认知识到ChromaDB"""
        try:
            self.collection.add(
                ids=[k["id"] for k in DEFAULT_KNOWLEDGE],
                documents=[k["content"] for k in DEFAULT_KNOWLEDGE],
                metadatas=[{"title": k["title"], "category": k["category"]} for k in DEFAULT_KNOWLEDGE]
            )
        except Exception as e:
            print(f"索引知识库失败: {e}")
    
    async def search(self, query: str, top_k: int = 3) -> str:
        """检索相关知识"""
        if self.use_chroma:
            return await self._chroma_search(query, top_k)
        else:
            return self._keyword_search(query, top_k)
    
    async def _chroma_search(self, query: str, top_k: int) -> str:
        """ChromaDB语义检索"""
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=min(top_k, self.collection.count())
            )
            
            if not results["documents"][0]:
                return ""
            
            context_parts = []
            for i, doc in enumerate(results["documents"][0]):
                metadata = results["metadatas"][0][i]
                context_parts.append(f"【{metadata.get('title', '')}】\n{doc}")
            
            return "\n\n".join(context_parts)
        except Exception as e:
            return self._keyword_search(query, top_k)
    
    def _keyword_search(self, query: str, top_k: int) -> str:
        """关键词检索（备用方案）"""
        query_lower = query.lower()
        scored = []
        
        for k in self.knowledge_base:
            score = 0
            content_lower = k["content"].lower()
            
            # 关键词匹配
            keywords = query_lower.split()
            for kw in keywords:
                if len(kw) > 1 and kw in content_lower:
                    score += 2
                if len(kw) > 1 and kw in k["title"].lower():
                    score += 3
            
            # 类别匹配
            if "历史" in query and k["category"] == "history":
                score += 5
            if "路线" in query and k["category"] == "route":
                score += 5
            if "自然" in query and k["category"] == "route" and "自然" in k["title"]:
                score += 5
            if "票" in query or "价格" in query or "开放" in query:
                if k["category"] == "faq":
                    score += 8
            
            if score > 0:
                scored.append((score, k))
        
        scored.sort(key=lambda x: x[0], reverse=True)
        
        context_parts = []
        for score, k in scored[:top_k]:
            context_parts.append(f"【{k['title']}】\n{k['content']}")
        
        return "\n\n".join(context_parts)
    
    async def add_document(self, doc_id: str, title: str, category: str, content: str):
        """添加文档到知识库"""
        new_doc = {"id": doc_id, "title": title, "category": category, "content": content}
        self.knowledge_base.append(new_doc)
        
        if self.use_chroma:
            try:
                self.collection.add(
                    ids=[doc_id],
                    documents=[content],
                    metadatas=[{"title": title, "category": category}]
                )
            except Exception as e:
                print(f"添加到ChromaDB失败: {e}")
    
    async def delete_document(self, doc_id: str):
        """删除文档"""
        self.knowledge_base = [k for k in self.knowledge_base if k["id"] != doc_id]
        
        if self.use_chroma:
            try:
                self.collection.delete(ids=[doc_id])
            except:
                pass
    
    def get_all_documents(self) -> list:
        """获取所有文档"""
        return self.knowledge_base
