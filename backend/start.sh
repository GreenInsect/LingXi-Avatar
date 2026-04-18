#!/bin/bash
# ================================================================
# 灵山胜境 AI 导游系统 — 后端启动脚本（vLLM 推理后端）
# ================================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   灵山胜境 AI 数字人导游系统  v2.1.0        ║"
echo "  ║   LangGraph + Qwen3(vLLM) + RAG            ║"
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

# ── 检查 vLLM 服务 ─────────────────────────────────────────────
echo -e "\n${BLUE}🔍 检查 vLLM 推理服务...${NC}"

CHAT_PORT=${VLLM_CHAT_BASE_URL:-http://localhost:8001}
VL_PORT=${VLLM_VL_BASE_URL:-http://localhost:8002}
EMBED_PORT=${VLLM_EMBED_BASE_URL:-http://localhost:8003}

check_vllm() {
    local url=$1; local name=$2
    if curl -sf "${url}/v1/models" -H "Authorization: Bearer vllm-no-key-required" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ ${name} 在线 (${url})${NC}"
        return 0
    else
        echo -e "  ${RED}❌ ${name} 未响应 (${url})${NC}"
        return 1
    fi
}

VLLM_OK=true
check_vllm "$CHAT_PORT"  "Chat 模型 (Qwen3-7B)"  || VLLM_OK=false
check_vllm "$VL_PORT"    "VL 模型 (Qwen3-VL-7B)" || VLLM_OK=false
check_vllm "$EMBED_PORT" "Embed 模型 (Qwen3-Embedding-0.6B)"      || VLLM_OK=false

if [ "$VLLM_OK" = false ]; then
    echo -e "\n${YELLOW}⚠️  部分 vLLM 服务未启动，系统将以降级模式运行（兜底静态回复）${NC}"
    echo -e "${YELLOW}   请参考以下命令启动 vLLM（需要 GPU + pip install vllm）：${NC}"
    echo ""
    echo "   # 对话模型（新终端）"
    echo "   vllm serve Qwen/Qwen3-VL-8B-Instruct --port 8001 --dtype auto"
    echo ""
    echo "   # 视觉语言模型（新终端）"
    echo "   vllm serve Qwen/Qwen3-VL-8B-Instruct --port 8002 --dtype auto \\"
    echo "       --limit-mm-per-prompt image=5 --max-model-len 8192"
    echo ""
    echo "   # 嵌入模型（新终端）"
    echo "   vllm serve Qwen/Qwen3-Embedding-0.6B --port 8003 --task embedding --dtype auto"
    echo ""
fi

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
echo "   管理端: cd frontend-admin  && npm install && npm run dev  → http://localhost:3001"
echo -e "\n${YELLOW}按 Ctrl+C 停止服务${NC}\n"

uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
