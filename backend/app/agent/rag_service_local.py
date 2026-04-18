"""
RAG 知识库服务 青春版 - Qwen3-Embedding-0.6B Embedding + ChromaDB 向量检索
"""
# TODO 待完善为动态从数据库加载知识文档，并支持在线更新（增删改）
# TODO 后续可增加 RAG 生成式检索（RAG-Gen）
# TODO 后续可增加用户画像和会话上下文感知的个性化检索
# TODO 后续可增加多模态检索（图像内容 + 文本查询）
from __future__ import annotations

import os
import uuid
from typing import Optional
from openai import AsyncOpenAI

import chromadb
from chromadb import EmbeddingFunction, Documents, Embeddings

from app.core.config import settings
from app.agent.qwen_client import qwen_client

# 灵山胜境知识库(战损测试版)
LINGSHAN_KNOWLEDGE = [
    {
        "id": "ls_history_001",
        "category": "history",
        "title": "灵山胜境历史渊源",
        "content": """灵山胜境坐落于江苏省无锡市太湖西北部的马山镇，地处秦履峰、青龙山、白虎山三山环抱之间，
占地面积约30万平方米，是国家5A级旅游景区、世界佛教论坛永久会址，被誉为"东方佛国"和"太湖佛国"。
唐贞观年间，玄奘法师西行取经归来，见此地"层峦丛翠，曲水净秀，山形酷似印度灵鹫山"，
遂命名为"小灵山"，并嘱咐大弟子窥基法师在此住持道场，建小灵山庵。
北宋大中祥符年间（1008-1016年），宋真宗赐额"祥符禅寺"，成为江南名刹。
1994年修建工程奠基，1997年11月15日灵山大佛落成开光，2009年灵山梵宫正式开放。"""
    },
    {
        "id": "ls_dafa_001",
        "category": "attraction",
        "title": "灵山大佛",
        "content": """灵山大佛通高88米（佛体79米，莲花瓣9米），含台基总高101.5米，总用铜量725吨，
由2000块铸铜面板拼接而成，是世界最高露天青铜释迦牟尼立像。
右手施无畏印（除却众生痛苦），左手施与愿印（赐予众生欢乐）。
216级登云道暗合108烦恼与108愿望，前段108级"烦恼尽除"，后段108级"願望圆满"。
登顶可俯瞰太湖全景，夕阳时分金光普照，美不胜收。
开放时间：08:00-17:00（冬季提前至16:30）。"""
    },
    {
        "id": "ls_jiulong_001",
        "category": "performance",
        "title": "九龙灌浴表演",
        "content": """九龙灌浴总高27.2米，核心为7.2米高鎏金太子佛像，重12吨，周围环绕9条飞龙。
表演时莲花铜雕缓缓绽放，太子佛在《佛之诞》乐曲中升起旋转，九条飞龙同时喷出水柱为太子沐浴，
水幕与阳光交织出七彩佛光，完美再现"花开见佛"的祥瑞场景。
表演后可在广场两侧接取龙头流出的"圣水"，寓意祈福安康。
平日演出时间：10:00、11:30、13:30、15:00；
周末及节假日增加场次，每场约15分钟，建议提前10分钟到场占位。"""
    },
    {
        "id": "ls_fangong_001",
        "category": "attraction",
        "title": "灵山梵宫",
        "content": """灵山梵宫建筑面积72000㎡，最高处66.5米，被誉为"东方卢浮宫"，
第二、四届世界佛教论坛举办地，荣获中国建筑工程最高奖鲁班奖。
内部汇集东阳木雕、琉璃巨制《华藏世界》（160块彩色琉璃拼接，目前世界最大琉璃艺术作品之一）、
28米高星空穹顶、大型油画"世界佛教传法图"等非遗艺术。
圣坛为曼陀罗形态，可容纳2000人，全球唯一大型旋转舞台。
《灵山吉祥颂》演出：10:35、11:30、14:00、16:00，每场约20分钟，凭景区门票免费入场，建议提前30分钟排队。
开放时间：09:00-17:00（冬季16:30）。"""
    },
    {
        "id": "ls_wuyin_001",
        "category": "attraction",
        "title": "五印坛城",
        "content": """五印坛城位于香水海中央的独立圆岛上，被称为"小布达拉宫"。
五层重檐楼宇，总高约30米，藏式碉楼建筑风格，白墙红边金顶。
四门分别安置马宝、孔雀、共命鸟、象宝四尊瑞兽雕塑。
内部墙体绘有彩色唐卡（天然矿物颜料），转经筒长廊环绕主殿，108个纯铜转经筒。
顺时针转动转经筒，寓意祈福消灾、积累功德。
登至顶层观景台可俯瞰香水海、灵山梵宫与灵山大佛全景。
藏香制作体验：10:00、14:00（需预约，费用自理）。
开放时间：09:00-17:00（冬季16:30）。"""
    },
    {
        "id": "ls_xiangfu_001",
        "category": "temple",
        "title": "祥符禅寺",
        "content": """祥符禅寺始建于唐贞观年间，由玄奘法师弟子窥基大师开坛讲经，
北宋年间正式更名为"祥符禅寺"，是江南千年禅宗祖庭。
寺内有重12.8吨"祥符禅钟"（江南第一钟），钟声浑厚洪亮，响彻整个灵山山谷。
六角井是唐代名泉，曾被茶圣陆羽品鉴，列为江南名泉之一，井水清澈甘甜。
千年古银杏树龄超千年，秋季金黄的树叶铺满寺院，意境绝美。
可参与撞钟祈福，体验佛教文化的庄严与神圣。全天开放。"""
    },
    {
        "id": "ls_route_history",
        "category": "route",
        "title": "历史文化路线推荐",
        "content": """历史文化爱好者路线（约6小时深度游）：
南门入园 → 灵山大照壁（华夏第一壁，赵朴初题字）→ 佛手广场（天下第一掌）
→ 祥符禅寺（千年古刹，撞钟祈福）→ 灵山大佛（登216级台阶，俯瞰太湖）
→ 灵山梵宫（佛教艺术殿堂，观《吉祥颂》）→ 五印坛城（藏传佛教文化体验）→ 出口
讲解重点：玄奘法师与小灵山渊源、江南第一钟文化意义、青铜铸造工艺、
穹顶天象图创作依据、108转经筒祈福文化。
建议上午9点前入园，梵宫演出提前30分钟排队，夕阳时分拍大佛最美。"""
    },
    {
        "id": "ls_route_nature",
        "category": "route",
        "title": "自然风光路线推荐",
        "content": """自然风光爱好者路线（约5小时）：
南门入园 → 佛足坛（朝圣打卡）→ 九龙灌浴（观赏动态表演）
→ 菩提大道（250米印度菩提树拱廊）→ 灵山大佛（登顶俯瞰太湖）
→ 曼飞龙塔（傣族风格，夜间灯光绝美）→ 灵山精舍（禅意素斋）→ 出口
九龙灌浴提前10分钟到场，大佛平台观日落最佳，灵山精舍素斋值得品尝。"""
    },
    {
        "id": "ls_route_family",
        "category": "route",
        "title": "亲子家庭路线推荐",
        "content": """亲子家庭路线（约4小时轻松游）：
南门入园 → 九龙灌浴（动态表演，孩子最爱）→ 佛手广场（摸天下第一掌）
→ 百子戏弥勒（摸弥勒肚皮祈福，亲子互动拍照）→ 灵山梵宫（全息演出）
→ 五印坛城（转经筒体验）→ 出口
全程约4公里，孩子可乘观光车（40元/人），百子戏弥勒亲子互动超有趣，
梵宫《吉祥颂》演出孩子喜欢，建议提前30分钟占座。"""
    },
    {
        "id": "ls_ticket_001",
        "category": "faq",
        "title": "门票与优惠政策",
        "content": """灵山胜境门票价格：
成人票：210元（18周岁以上）
半价票：105元（6-18周岁未成年人、全日制本科及以下学生、60-69周岁老人）
免费：6周岁以下或1.4米以下儿童、70周岁以上老人、现役军人、残疾人
网购联票：225元（门票+观光车，无限次乘坐，更划算）
观光车单独购票：40元/人
导游服务：300元起"""
    },
    {
        "id": "ls_open_001",
        "category": "faq",
        "title": "开放时间与注意事项",
        "content": """开放时间：
夏季（4月-10月）：08:00-18:00
冬季（11月-3月）：08:30-17:00
建议上午9点前入园避开人流高峰，下午可观赏太湖日落。
最佳游览季节：春秋季节（3-5月、9-11月）气候宜人，春有樱花桃花，秋有银杏金黄。
注意事项：穿舒适运动鞋，夏季防晒，景区为佛教场所需保持安静，
不触摸佛像，部分区域禁止拍照（梵宫内禁用闪光灯）。"""
    },
    {
        "id": "ls_dining_001",
        "category": "dining",
        "title": "餐饮与住宿推荐",
        "content": """景区内餐饮：
梵宫素斋自助：50元/位，清淡雅致，体验佛门饮食文化，菜品丰富
素面套餐：35元/位，景区内多处餐厅，口味清淡，快速用餐
灵山精舍素斋：环境优雅，菜品精致，适合深度体验佛教文化
住宿：灵山精舍（景区内禅意酒店），含素斋与早课体验；
周边马山镇有多家酒店、民宿，价格几百至上千元不等。"""
    },
    {
        "id": "ls_nianhewan_001",
        "category": "nianhewan",
        "title": "拈花湾禅意小镇",
        "content": """拈花湾禅意小镇与灵山胜境比邻，以"禅意慢生活"为核心，开放时间09:00-21:30（冬季至20:30）。
主要景点：
拈花广场：入口核心，12米"拈花微笑"青铜雕塑，每日9:30开园仪式
梵天花海：30000㎡四季花海，春格桑花、夏硫华菊、秋波斯菊
香月花街：800米禅意商业街，非遗手作、禅茶美食、夜间灯笼绝美
拈花堂：免费禅坐冥想、抄经、禅茶品鉴，禅意讲座10:30/15:30
五灯湖：小镇最大水景，夜间《禅行》灯光秀19:00、20:00（约30分钟）"""
    },
    {
        "id": "ls_spots_other",
        "category": "attraction",
        "title": "其他特色景点",
        "content": """佛手广场（天下第一掌）：灵山大佛右手复制，高11.7米，宽5.5米，摸掌祈福保平安。
百子戏弥勒：9吨青铜群雕，弥勒佛身上百名孩童，摸肚皮寓意享一生福气。
曼飞龙塔：傣族风格九塔组合，主塔高16.9m，南传佛教代表，夜间灯光亮化绝美。
佛教文化博览馆：设于大佛三层座基内，10000㎡三层展馆，
一层五方五佛，二层世界佛教史，三层万佛殿（9999尊小佛像），免费参观。
无尽意斋：赵朴初先生纪念馆，北京四合院风格，展示书法作品与灵山渊源，免费开放。"""
    },
]


# Qwen Embedding 函数（供 ChromaDB 使用
class QwenEmbeddingFunction(EmbeddingFunction):
    """ChromaDB 自定义 Embedding，通过 vLLM /v1/embeddings 调用 Qwen3-Embedding-0.6B 模型"""

    def __call__(self, input: Documents) -> Embeddings:
        import asyncio
        loop = asyncio.new_event_loop()
        try:
            embeddings = loop.run_until_complete(
                qwen_client.embed_batch(input)
            )
            return embeddings
        finally:
            loop.close()


class RAGService:
    """
    RAG 检索增强生成服务

    架构：
      文档 → Qwen Embedding → ChromaDB 向量存储
      查询 → Qwen Embedding → 余弦相似度检索 → 返回 Top-K 文档片段
    """

    def __init__(self):
        self._initialized = False
        self.collection = None
        self._use_embedding = False
        # 如果调用百炼，base_url 为 https://dashscope.aliyuncs.com/compatible-mode/v1
        # 如果调用本地，base_url 为 http://localhost:8001/v1
        self.client = AsyncOpenAI(
            api_key=settings.DASHSCOPE_API_KEY, 
            base_url=settings.VLLM_EMBED_BASE_URL
        )
        self.embed_model = settings.EMBEDDING_MODEL  # 如 "text-embedding-v4" 或本地模型名
    
    async def embed(self, text: str) -> list[float]:
        """
        使用官方 SDK 调用向量接口，支持维度定义
        """
        try:
            response = await self.client.embeddings.create(
                model=self.embed_model,
                input=text,
                # 针对 text-embedding-v4 等模型可以指定维度，如果是本地小模型则去掉此参数
                dimensions=1024 if "v4" in self.embed_model else None,
                encoding_format="float"
            )
            # SDK 会自动解析响应格式，直接访问对象属性即可
            return response.data[0].embedding
        except Exception as e:
            # 在这里可以添加日志记录，方便科研调试
            print(f"Embedding Error: {e}")
            raise e

    def initialize(self):
        """同步初始化（在应用启动时调用）"""
        if self._initialized:
            return
        try:
            os.makedirs(settings.CHROMA_DB_DIR, exist_ok=True)
            client = chromadb.PersistentClient(path=settings.CHROMA_DB_DIR)

            # 尝试使用 vLLM Qwen3-Embedding-0.6B Embedding，失败则降级到默认
            try:
                ef = QwenEmbeddingFunction()
                self.collection = client.get_or_create_collection(
                    name="lingshan_knowledge_vllm",
                    embedding_function=ef,
                    metadata={"hnsw:space": "cosine"},
                )
                self._use_embedding = True
                print("✅ vLLM Qwen3-Embedding-0.6B Embedding 初始化成功")
            except Exception as e:
                print(f"⚠️  vLLM Embedding 不可用，使用默认嵌入: {e}")
                self.collection = client.get_or_create_collection(
                    name="lingshan_knowledge_default",
                    metadata={"hnsw:space": "cosine"},
                )
                self._use_embedding = False

            # 索引内置知识库
            if self.collection.count() == 0:
                self._index_knowledge(LINGSHAN_KNOWLEDGE)
                print(f"✅ 已索引 {len(LINGSHAN_KNOWLEDGE)} 条灵山胜境知识")

            self._initialized = True
        except Exception as e:
            print(f"❌ RAG 初始化失败: {e}")
            self._initialized = False

    def _index_knowledge(self, docs: list[dict]):
        """将知识文档索引到向量库"""
        self.collection.add(
            ids=[d["id"] for d in docs],
            documents=[d["content"] for d in docs],
            metadatas=[{"title": d["title"], "category": d["category"]} for d in docs],
        )

    async def search(self, query: str, top_k: int = None) -> list[dict]:
        """
        语义检索相关知识片段

        Returns:
            list of {"title": str, "content": str, "category": str, "score": float}
        """
        k = top_k or settings.RAG_TOP_K
        if not self._initialized or self.collection is None:
            return self._keyword_search(query, k)

        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=min(k, max(self.collection.count(), 1)),
            )
            docs = []
            if results["documents"] and results["documents"][0]:
                for i, content in enumerate(results["documents"][0]):
                    meta = results["metadatas"][0][i] if results["metadatas"] else {}
                    dist = results["distances"][0][i] if results.get("distances") else 0.0
                    score = max(0.0, 1.0 - dist)  # 余弦距离转相似度
                    docs.append({
                        "title": meta.get("title", ""),
                        "category": meta.get("category", ""),
                        "content": content,
                        "score": round(score, 4),
                    })
            return docs
        except Exception as e:
            print(f"⚠️  向量检索失败，降级到关键词检索: {e}")
            return self._keyword_search(query, k)

    def _keyword_search(self, query: str, top_k: int) -> list[dict]:
        """关键词检索降级方案"""
        scored = []
        query_lower = query.lower()

        category_keywords = {
            "history": ["历史", "渊源", "唐", "宋", "玄奘", "千年"],
            "attraction": ["景点", "大佛", "梵宫", "坛城", "塔", "寺"],
            "performance": ["表演", "演出", "九龙", "吉祥颂", "时间", "场次"],
            "route": ["路线", "游览", "推荐", "行程", "怎么玩"],
            "faq": ["门票", "价格", "开放", "时间", "停车", "注意"],
            "dining": ["餐饮", "吃饭", "素斋", "住宿", "酒店"],
            "nianhewan": ["拈花湾", "小镇", "花海", "灯光秀"],
            "temple": ["禅寺", "祥符", "撞钟", "银杏", "古井"],
        }

        for doc in LINGSHAN_KNOWLEDGE:
            score = 0.0
            content_lower = doc["content"].lower()
            title_lower = doc["title"].lower()

            # 内容匹配
            for char in query_lower:
                if char in content_lower:
                    score += 0.1
            # 标题匹配（权重更高）
            for char in query_lower:
                if char in title_lower:
                    score += 0.3

            # 类别关键词加权
            for cat, kws in category_keywords.items():
                if doc["category"] == cat and any(kw in query for kw in kws):
                    score += 2.0

            if score > 0:
                scored.append((score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {
                "title": d["title"],
                "category": d["category"],
                "content": d["content"],
                "score": round(s / 10, 4),
            }
            for s, d in scored[:top_k]
        ]

    async def add_document(self, doc_id: str, title: str, category: str, content: str):
        """动态添加文档到知识库"""
        if self.collection is None:
            return
        try:
            self.collection.add(
                ids=[doc_id],
                documents=[content],
                metadatas=[{"title": title, "category": category}],
            )
        except Exception as e:
            print(f"添加文档失败: {e}")

    async def delete_document(self, doc_id: str):
        """删除文档"""
        if self.collection is None:
            return
        try:
            self.collection.delete(ids=[doc_id])
        except Exception as e:
            print(f"删除文档失败: {e}")

    def get_all_documents(self) -> list[dict]:
        """返回所有内置知识文档"""
        return LINGSHAN_KNOWLEDGE

    def format_context(self, docs: list[dict], max_chars: int = 2000) -> str:
        """将检索结果格式化为 Prompt 上下文"""
        if not docs:
            return "（未检索到相关景区知识，请根据通用佛教文化知识回答）"
        parts = []
        total = 0
        for doc in docs:
            snippet = f"【{doc['title']}】（相关度{doc['score']:.0%}）\n{doc['content']}"
            if total + len(snippet) > max_chars:
                break
            parts.append(snippet)
            total += len(snippet)
        return "\n\n---\n\n".join(parts)
    

# 全局单例
rag_service = RAGService()
