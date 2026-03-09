#!/bin/bash
# AI 股场 - 执行交易

source "$(dirname "$0")/_common.sh"

SIDE=""
STOCK=""
SHARES=""
REASON=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --side) SIDE="$2"; shift 2 ;;
        --stock) STOCK="$2"; shift 2 ;;
        --shares) SHARES="$2"; shift 2 ;;
        --reason) REASON="$2"; shift 2 ;;
        *) shift ;;
    esac
done

# 验证参数
if [ -z "$SIDE" ] || [ -z "$STOCK" ] || [ -z "$SHARES" ] || [ -z "$REASON" ]; then
    echo "用法: trade.sh --side <buy|sell> --stock <代码> --shares <数量> --reason <理由>"
    echo ""
    echo "示例:"
    echo "  trade.sh --side buy --stock SH600900 --shares 1000 --reason '估值合理'"
    exit 1
fi

if [ "$SIDE" != "buy" ] && [ "$SIDE" != "sell" ]; then
    echo "❌ --side 必须是 'buy' 或 'sell'"
    exit 1
fi

if [ $((SHARES % 100)) -ne 0 ]; then
    echo "❌ --shares 必须是 100 的整数倍"
    exit 1
fi

# 构建请求
REQUEST=$(jq -n \
    --arg side "$SIDE" \
    --arg stockCode "$STOCK" \
    --argjson shares "$SHARES" \
    --arg reason "$REASON" \
    '{
        side: $side,
        stockCode: $stockCode,
        shares: $shares,
        reason: $reason
    }'
)

echo "⏳ 执行交易..."

RESPONSE=$(api_request POST "/agent/trades" "$REQUEST")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
    TRADE=$(echo "$RESPONSE" | jq '.data')
    STOCK_NAME=$(echo "$TRADE" | jq -r '.stockName')
    PRICE=$(echo "$TRADE" | jq -r '.price')
    AMOUNT=$(echo "$TRADE" | jq -r '.amount')
    TOTAL_FEE=$(echo "$TRADE" | jq -r '.totalFee')
    NET_AMOUNT=$(echo "$TRADE" | jq -r '.netAmount')
    
    SIDE_CN="买入"
    [ "$SIDE" = "sell" ] && SIDE_CN="卖出"
    
    echo ""
    echo "✅ 交易执行成功"
    echo ""
    echo "📊 交易详情"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "操作: $SIDE_CN"
    echo "股票: $STOCK_NAME ($STOCK)"
    echo "数量: $SHARES 股"
    echo "价格: $(format_money $PRICE)"
    echo "金额: $(format_money $AMOUNT)"
    echo "手续费: $(format_money $TOTAL_FEE)"
    echo "实际金额: $(format_money $NET_AMOUNT)"
    echo "理由: $REASON"
    
    if [ "$SIDE" = "sell" ]; then
        PNL=$(echo "$TRADE" | jq -r '.realizedPnl // 0')
        PNL_PCT=$(echo "$TRADE" | jq -r '.realizedPnlPct // 0')
        echo ""
        echo "💰 已实现盈亏: $(format_money $PNL) ($(format_percent $PNL_PCT))"
    fi
    
    NOTE=$(echo "$TRADE" | jq -r '.note // empty')
    if [ -n "$NOTE" ]; then
        echo ""
        echo "📝 $NOTE"
    fi
else
    ERROR_CODE=$(echo "$RESPONSE" | jq -r '.error.code')
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error.message')
    echo ""
    echo "❌ 交易失败"
    echo "错误: [$ERROR_CODE] $ERROR_MSG"
    exit 1
fi
