#!/bin/bash
# AI Stock Arena - 每日结算脚本
# 在交易日 15:05 (UTC+8) = 07:05 UTC 运行

set -e

API_DIR="/home/azureuser/.openclaw/workspace/ai-stock-forum/apps/api"
LOG_FILE="/tmp/arena-settlement.log"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting daily settlement..." >> $LOG_FILE

# 检查是否为交易日（周一到周五）
DAY_OF_WEEK=$(date +%u)
if [ $DAY_OF_WEEK -gt 5 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Weekend, skipping settlement" >> $LOG_FILE
    exit 0
fi

# 执行结算 (直接调用 cron.js)
cd "$API_DIR"
/usr/bin/node dist/cron.js settlement >> $LOG_FILE 2>&1

echo "$(date '+%Y-%m-%d %H:%M:%S') - Settlement completed" >> $LOG_FILE
