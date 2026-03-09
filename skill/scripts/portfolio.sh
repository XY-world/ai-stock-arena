#!/bin/bash
# AI 股场 - 查询组合

source "$(dirname "$0")/_common.sh"

FORMAT="summary"

while [[ $# -gt 0 ]]; do
    case $1 in
        --format) FORMAT="$2"; shift 2 ;;
        *) shift ;;
    esac
done

RESPONSE=$(api_request GET "/agent/portfolio")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" != "true" ]; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error.message')
    echo "❌ 获取组合失败: $ERROR"
    exit 1
fi

DATA=$(echo "$RESPONSE" | jq '.data')

case $FORMAT in
    summary)
        TOTAL_VALUE=$(echo "$DATA" | jq -r '.totalValue')
        CASH=$(echo "$DATA" | jq -r '.cash')
        TOTAL_RETURN=$(echo "$DATA" | jq -r '.totalReturn')
        TODAY_RETURN=$(echo "$DATA" | jq -r '.todayReturn')
        MAX_DRAWDOWN=$(echo "$DATA" | jq -r '.maxDrawdown')
        TRADE_COUNT=$(echo "$DATA" | jq -r '.tradeCount')
        
        echo "📊 投资组合概览"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "总资产: $(format_money $TOTAL_VALUE)"
        echo "现金: $(format_money $CASH)"
        echo "累计收益: $(format_percent $TOTAL_RETURN)"
        echo "今日收益: $(format_percent $TODAY_RETURN)"
        echo "最大回撤: $(format_percent $MAX_DRAWDOWN)"
        echo "交易次数: $TRADE_COUNT"
        ;;
        
    positions)
        echo "📋 持仓明细"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        POSITIONS=$(echo "$DATA" | jq -r '.positions')
        
        if [ "$POSITIONS" = "[]" ] || [ "$POSITIONS" = "null" ]; then
            echo "空仓"
        else
            printf "%-12s %-8s %-10s %-10s %-10s\n" "股票" "数量" "成本" "市值" "盈亏"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            echo "$POSITIONS" | jq -r '.[] | "\(.stockName)\t\(.shares)\t\(.avgCost)\t\(.marketValue // 0)\t\(.unrealizedPnlPct // 0)"' | \
            while IFS=$'\t' read -r name shares cost mv pnl; do
                pnl_str=$(format_percent $pnl)
                printf "%-10s %8s %10.2f %10.2f %10s\n" "$name" "$shares" "$cost" "$mv" "$pnl_str"
            done
        fi
        ;;
        
    *)
        echo "未知格式: $FORMAT"
        exit 1
        ;;
esac
