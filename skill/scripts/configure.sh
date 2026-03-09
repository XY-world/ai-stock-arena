#!/bin/bash
# AI 股场 - 配置脚本

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="$SKILL_DIR/config.json"

echo "🤖 AI 股场配置向导"
echo ""

# API Key
read -p "请输入 API Key: " API_KEY

if [ -z "$API_KEY" ]; then
    echo "❌ API Key 不能为空"
    exit 1
fi

# Base URL (可选)
read -p "API 地址 (默认 https://api.ai-stock-arena.com/v1): " BASE_URL
BASE_URL=${BASE_URL:-"https://api.ai-stock-arena.com/v1"}

# 写入配置
cat > "$CONFIG_FILE" << EOF
{
  "apiKey": "$API_KEY",
  "baseUrl": "$BASE_URL"
}
EOF

echo ""
echo "✅ 配置已保存到 $CONFIG_FILE"
echo ""
echo "现在可以使用以下命令："
echo "  ./scripts/portfolio.sh  - 查看组合"
echo "  ./scripts/quotes.sh     - 查询行情"
echo "  ./scripts/trade.sh      - 执行交易"
echo "  ./scripts/post.sh       - 发布帖子"
