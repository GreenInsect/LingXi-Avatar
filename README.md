# 🌸 AI数字人导游系统

> 基于 Claude 多模态大模型的智慧景区导览系统，支持语音/文本多模态交互、RAG知识库问答、游客情感分析与管理数据大屏。

---

## 📁 项目结构

```
ai-guide/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── main.py             # 应用入口
│   │   ├── core/
│   │   │   └── config.py       # 系统配置
│   │   ├── models/
│   │   │   └── database.py     # SQLAlchemy 数据模型
│   │   ├── api/
│   │   │   ├── chat.py         # 对话交互 API
│   │   │   ├── tts.py          # 语音合成 API
│   │   │   ├── knowledge.py    # 知识库查询 API
│   │   │   ├── admin.py        # 管理后台 API
│   │   │   └── analytics.py    # 数据分析 API
│   │   └── services/
│   │       ├── ai_service.py   # AI核心服务（Claude + RAG）
│   │       ├── knowledge_service.py  # 知识库服务（ChromaDB）
│   │       └── tts_service.py  # 语音合成服务（edge-tts）
│   ├── requirements.txt
│   ├── .env.example
│   └── start.sh
│
├── frontend-tourist/           # 游客交互端
│   └── index.html              # 数字人对话界面
│
├── frontend-admin/             # 管理后台
│   └── index.html              # 数据大屏 + 管理界面
│
└── README.md
```

---

## 🚀 快速启动

### 1. 配置环境

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入你的 Anthropic API Key
```

### 2. 安装依赖并启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

后端启动后访问：
- API 文档：http://localhost:5000/docs
- 健康检查：http://localhost:5000/health

### 3. 启动前端

**游客交互端**（用浏览器直接打开）：
```
frontend-tourist/index.html
```

**管理后台**（用浏览器直接打开）：
```
frontend-admin/index.html
```

> 前端为纯静态 HTML，无需 Node.js，直接双击打开即可使用。

---

## 🧠 技术架构

```
游客端 (HTML/JS)
    ↕ REST API
FastAPI 后端
    ├── Claude claude-sonnet-4-20250514 (多模态大模型)
    │       ├── 智能对话 & 情感感知
    │       ├── 路线推荐 & 知识问答
    │       └── 游客情感报告生成
    ├── ChromaDB (向量数据库 RAG)
    │       └── 景区知识语义检索
    ├── edge-tts (语音合成，免费)
    │       └── 多音色中文 TTS
    └── SQLite (对话 & 配置持久化)
```

### 核心 AI 能力

| 能力 | 技术 | 说明 |
|------|------|------|
| 多模态大模型 | Claude claude-sonnet-4-20250514 | 对话、情感分析、报告生成 |
| 知识库检索 | ChromaDB + Embedding | 语义搜索，优先命中相关景区知识 |
| 语音合成 | edge-tts（免费）| 多音色中文语音，无需付费 API |
| 情感分析 | Claude API | 分析游客消息情绪，驱动数字人表情 |
| RAG 问答 | 自建知识库 + Claude | 确保景区问答准确率 ≥90% |

---

## 🎯 功能清单

### 游客交互端
- ✅ 文本输入对话
- ✅ 语音录制（Web Speech API）
- ✅ 数字人 SVG 形象展示（口型/表情变化）
- ✅ 语音播报回答（edge-tts）
- ✅ 实时情感反馈（表情指示器）
- ✅ 快捷问题按钮
- ✅ 兴趣偏好选择（个性化推荐）
- ✅ GPS 位置获取（辅助路线推荐）
- ✅ 水墨风格界面（沉浸式体验）

### 管理后台
- ✅ 数据大屏（今日/本周/累计服务量）
- ✅ 满意度趋势图（近7天）
- ✅ 游客情感分布饼图
- ✅ 热门问答关键词榜单
- ✅ 系统实时状态监控
- ✅ 知识库文档管理（增删改查）
- ✅ 文档文件上传（.txt/.md）
- ✅ 数字人形象配置
- ✅ 语音音色切换
- ✅ AI 生成游客感受度报告
- ✅ 对话记录查看与分页

---

## 🗂️ 景区知识库

系统内置示例知识库，涵盖：
- 📜 历史沿革（建筑年代、历史事件）
- 🎭 文化特色（节庆活动、非遗展示）
- 🗺️ 游览路线（历史文化线 / 自然生态线）
- ❓ 常见问题（票价、开放时间、停车、餐饮）
- 🏛️ 核心景点介绍（清晖阁、荷花池、百花苑）

管理员可通过后台随时更新、补充知识内容。

---

## 🌐 API 接口说明

### 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat/message` | 发送消息，获取 AI 回复+语音 |
| GET  | `/api/chat/history/{session_id}` | 获取会话历史 |
| POST | `/api/tts/synthesize` | 独立语音合成 |
| GET  | `/api/analytics/dashboard` | 数据大屏数据 |
| GET  | `/api/analytics/sentiment-report` | 生成感受度报告 |
| GET  | `/api/admin/avatar/list` | 数字人配置列表 |
| POST | `/api/admin/knowledge/add` | 添加知识文档 |
| POST | `/api/admin/knowledge/upload` | 上传知识文件 |

完整 API 文档：启动后访问 http://localhost:5000/docs

---

## ⚡ 性能说明

| 指标 | 目标 | 实现方式 |
|------|------|---------|
| 语音问答延迟 | < 5秒 | Claude API + 并行 TTS 合成 |
| 知识问答准确率 | ≥ 90% | RAG 知识库 + Claude 理解 |
| 系统稳定性 | 无崩溃 | FastAPI + 异常捕获 + 降级策略 |
| 并发支持 | 多用户 | 异步 FastAPI + SQLite/PostgreSQL |

---

## 🔧 生产环境部署建议

1. **数据库**：将 SQLite 替换为 PostgreSQL
2. **向量库**：ChromaDB 可替换为 Milvus（更高并发）
3. **语音识别**：集成科大讯飞/腾讯云 ASR（提升语音输入准确率）
4. **数字人渲染**：集成 D-ID / HeyGen API（实现更逼真的视频数字人）
5. **反向代理**：Nginx 统一代理前后端
6. **HTTPS**：Let's Encrypt 证书

---

## 📍 GPS 定位方案（可选扩展）

针对室内 GPS 信号弱的问题，建议方案：
- **蓝牙 iBeacon**：景区关键节点部署 Beacon，游客 App 通过 BLE 定位（精度 3-5m）
- **WiFi 定位**：多 AP 信号强度三角定位（精度 5-15m）
- **二维码签到**：各景点设置扫码点，游客扫码触发位置上报（低成本备选）

当前系统已预留 `location` 参数接口，支持接入上述任意定位方案。

---

## 📄 License

MIT License — 自由使用，欢迎基于此系统二次开发。
