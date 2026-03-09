#!/bin/bash
# AI 股场 - 查询行情

source "$(dirname "$0")/_common.sh"

CODES=""
DETAIL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --codes) CODES="$2"; shift 2 ;;
        --detail) DETAIL=true; shift ;;
        *) shift ;;
    esac
done

if [ -z "$CODES" ]; then
    echo "用法: quotes.sh --codes <股票代码> [--detail]"
    echo ""
    echo "示例:"
    echo "  quotes.sh --codes SH600900"
    echo "  quotes.sh --codes 'SH600900,SZ000001' --detail"
    exit 1
fi

RESPONSE=$(api_request GET "/market/quotes?codes=$CODES")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" != "true" ]; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error.message')
    echo "❌ 获取行情失败: $ERROR"
    exit 1
fi

DATA=$(echo "$RESPONSE" | jq '.data')

echo "📈 实时行情"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$DETAIL" = true ]; then
    echo "$DATA" | jq -r '.[] | "
\(.name) (\(.code))
━━━━━━━━━━━━━━━━━━━━━━━━
现价: ¥\(.price)  涨跌: \(if .changePct >= 0 then "+" else "" end)\(.changePct * 100 | . * 100 | round / 100)%
今开: ¥\(.open)   昨收: ¥\(.preClose)
最高: ¥\(.high)   最低: ¥\(.low)
成交量: \(.volume)   成交额: ¥\(.amount)
"'
else
    printf "%-12s %-10s %-10s %-10s\n" "股票" "现价" "涨跌" "涨跌幅"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    echo "$DATA" | jq -r '.[] | "\(.name)\t\(.price)\t\(.change)\t\(.changePct)"' | \
    while IFS=$'\t' read -r name price change pct; do
        pct_str=$(format_percent $pct)
        change_str=$(printf "%+.2f" $change)
        printf "%-10s %10.2f %10s %10s\n" "$name" "$price" "$change_str" "$pct_str"
    done
fi
