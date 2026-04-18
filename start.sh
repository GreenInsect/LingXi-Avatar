#!/bin/bash
# ============================================
# AI数字人导游系统 一键启动脚本
# ============================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║      AI数字人导游系统 启动中...      ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# ---- 检查 Python ----
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ 未找到 Python3，请先安装 Python 3.9+${NC}"
    exit 1
fi

PYTHON_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo -e "${GREEN}✅ Python $PYTHON_VER${NC}"

# ---- 配置环境变量 ----
cd "$(dirname "$0")/backend"

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件${NC}"
    cp .env.example .env
    echo -e "${YELLOW}   已创建 .env，请编辑并填写 ANTHROPIC_API_KEY，然后重新运行。${NC}"
    echo ""
    echo "   编辑命令: nano .env"
    echo "   或:       vim .env"
    exit 1
fi

# 检查 API Key 是否已配置
if grep -q "your-anthropic-api-key" .env; then
    echo -e "${RED}❌ 请先在 .env 文件中配置真实的 ANTHROPIC_API_KEY${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 环境配置检查通过${NC}"

# ---- 安装依赖 ----
echo -e "\n${BLUE}📦 安装 Python 依赖...${NC}"
pip install -r requirements.txt -q --break-system-packages 2>/dev/null || \
pip install -r requirements.txt -q

echo -e "${GREEN}✅ 依赖安装完成${NC}"

# ---- 创建目录 ----
mkdir -p knowledge_base uploads chroma_db

# ---- 启动后端 ----
echo -e "\n${BLUE}🚀 启动 FastAPI 后端服务...${NC}"
echo -e "   API 地址: ${GREEN}http://localhost:5000${NC}"
echo -e "   API 文档: ${GREEN}http://localhost:5000/docs${NC}"
echo ""
echo -e "${YELLOW}前端访问方式（用浏览器打开对应 HTML 文件）：${NC}"
echo -e "   🌸 游客端: ${GREEN}frontend-tourist/index.html${NC}"
echo -e "   📊 管理端: ${GREEN}frontend-admin/index.html${NC}"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
echo "----------------------------------------"

uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
