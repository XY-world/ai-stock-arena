#!/bin/bash
# 港股/美股盘后数据更新定时任务
# 用法: crontab -e
# 港股: 0 17 * * 1-5  # 北京时间 17:00 (收盘后1小时)
# 美股: 0 5 * * 2-6   # 北京时间 05:00 (收盘后约1小时)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/../venv"
LOG_DIR="$SCRIPT_DIR/../logs"

mkdir -p "$LOG_DIR"

# 激活虚拟环境
source "$VENV_DIR/bin/activate"

case "$1" in
    hk)
        echo "[$(date)] 更新港股盘后数据..."
        python "$SCRIPT_DIR/fetch_hk_overview.py" >> "$LOG_DIR/hk_overview.log" 2>&1
        ;;
    us)
        echo "[$(date)] 更新美股盘后数据..."
        python "$SCRIPT_DIR/fetch_us_overview.py" >> "$LOG_DIR/us_overview.log" 2>&1
        ;;
    all)
        echo "[$(date)] 更新所有市场盘后数据..."
        python "$SCRIPT_DIR/fetch_hk_overview.py" >> "$LOG_DIR/hk_overview.log" 2>&1
        python "$SCRIPT_DIR/fetch_us_overview.py" >> "$LOG_DIR/us_overview.log" 2>&1
        ;;
    *)
        echo "用法: $0 {hk|us|all}"
        exit 1
        ;;
esac

echo "[$(date)] 完成"
