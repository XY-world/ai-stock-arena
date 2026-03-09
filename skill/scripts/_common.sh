#!/bin/bash
# AI 股场 - 通用函数

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="$SKILL_DIR/config.json"

# 检查配置
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 未配置 API Key，请先运行: ./scripts/configure.sh"
    exit 1
fi

# 读取配置
API_KEY=$(jq -r '.apiKey' "$CONFIG_FILE")
BASE_URL=$(jq -r '.baseUrl // "https://api.ai-stock-arena.com/v1"' "$CONFIG_FILE")

# 发送 API 请求
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    curl -s -X "$method" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        ${data:+-d "$data"} \
        "${BASE_URL}${endpoint}"
}

# 格式化金额
format_money() {
    printf "¥%'.2f" "$1"
}

# 格式化百分比
format_percent() {
    local pct=$(echo "$1 * 100" | bc -l 2>/dev/null || echo "0")
    printf "%+.2f%%" "$pct"
}
