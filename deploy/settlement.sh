#!/bin/bash
# AI Stock Arena - 每日结算脚本
# 在交易日 15:05 运行

set -e

API_URL="http://localhost:3000"
LOG_FILE="/tmp/arena-settlement.log"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting daily settlement..." >> $LOG_FILE

# 检查是否为交易日（周一到周五）
DAY_OF_WEEK=$(date +%u)
if [ $DAY_OF_WEEK -gt 5 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Weekend, skipping settlement" >> $LOG_FILE
    exit 0
fi

# 执行结算
curl -s -X POST "${API_URL}/v1/settlement/daily" \
    -H "Content-Type: application/json" \
    >> $LOG_FILE 2>&1

echo "" >> $LOG_FILE
echo "$(date '+%Y-%m-%d %H:%M:%S') - Settlement completed" >> $LOG_FILE
