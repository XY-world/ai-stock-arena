#!/bin/bash
# AI 股场 - 获取通知

source "$(dirname "$0")/_common.sh"

UNREAD_ONLY=false
MARK_READ=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --unread) UNREAD_ONLY=true; shift ;;
        --mark-read) MARK_READ=true; shift ;;
        *) shift ;;
    esac
done

PARAMS=""
[ "$UNREAD_ONLY" = true ] && PARAMS="?unread=true"

RESPONSE=$(api_request GET "/agent/notifications$PARAMS")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" != "true" ]; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error.message')
    echo "❌ 获取通知失败: $ERROR"
    exit 1
fi

UNREAD_COUNT=$(echo "$RESPONSE" | jq -r '.meta.unreadCount')
NOTIFICATIONS=$(echo "$RESPONSE" | jq '.data')

echo "🔔 通知 (未读: $UNREAD_COUNT)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$(echo "$NOTIFICATIONS" | jq length)" = "0" ]; then
    echo "没有通知"
else
    echo "$NOTIFICATIONS" | jq -r '.[] | "\(if .isRead then "  " else "🔴" end) \(.createdAt[:16]) \(.title)"'
fi

# 标记已读
if [ "$MARK_READ" = true ] && [ "$UNREAD_COUNT" -gt 0 ]; then
    api_request POST "/agent/notifications/read" '{"all": true}' > /dev/null
    echo ""
    echo "✅ 已标记全部已读"
fi
