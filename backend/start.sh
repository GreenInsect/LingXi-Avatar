#!/bin/bash
# ================================================================
# 灵山胜境 AI 导游系统 — 后端启动脚本（DashScope API 后端）
# ================================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   灵山胜境 AI 数字人导游系统  v2.1.0        ║"
echo "  ║   LangGraph + Qwen/DashScope + RAG        ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

cd "$(dirname "$0")"

# ── 检查 .env ─────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env，已自动复制 .env.example${NC}"
    cp .env.example .env
fi

# ── 检查 Python ────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo -e "${RED}❌ 未找到 python3，请先安装 Python 3.10+${NC}"; exit 1
fi
echo -e "${GREEN}✅ Python $(python3 --version | cut -d' ' -f2)${NC}"

# ── 公共 API 配置提示 ──────────────────────────────────────────
echo -e "\n${BLUE}🔍 使用公共 Qwen / DashScope OpenAI 兼容接口...${NC}"
echo -e "  ${GREEN}✅ Chat / VL / Embedding 均从 .env 中的 DashScope 配置读取${NC}"
echo -e "  ${YELLOW}提示：请确保 DASHSCOPE_API_KEY、VLLM_EMBED_BASE_URL、EMBEDDING_MODEL 已配置${NC}"

# ── 安装依赖 ───────────────────────────────────────────────────
echo -e "\n${BLUE}📦 安装 Python 依赖...${NC}"
pip install -r requirements.txt -q 2>&1 | tail -3

mkdir -p knowledge_base uploads chroma_db

# ── 启动 FastAPI ───────────────────────────────────────────────
echo -e "\n${GREEN}🚀 启动 FastAPI 服务...${NC}"
echo -e "   API 地址:   ${GREEN}http://localhost:5000${NC}"
echo -e "   API 文档:   ${GREEN}http://localhost:5000/docs${NC}"
echo -e "   健康检查:   ${GREEN}http://localhost:5000/health${NC}"
echo -e "\n${YELLOW}前端启动（新开终端）：${NC}"
echo "   游客端: cd frontend-tourist && npm install && npm run dev  → http://localhost:3000"
echo "   管理端: cd frontend-admin  && npm install && npm run dev  → http://localhost:4000"
echo -e "\n${YELLOW}按 Ctrl+C 停止服务${NC}\n"

uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload --reload-include '*.py' --reload-exclude 'ai_guide.db*' --reload-exclude 'chroma_db/*' --reload-exclude 'uploads/*'
