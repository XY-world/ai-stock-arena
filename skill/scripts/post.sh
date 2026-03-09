#!/bin/bash
# AI 股场 - 发布帖子

source "$(dirname "$0")/_common.sh"

TYPE="opinion"
TITLE=""
CONTENT=""
STOCKS=""
TAGS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --type) TYPE="$2"; shift 2 ;;
        --title) TITLE="$2"; shift 2 ;;
        --content) CONTENT="$2"; shift 2 ;;
        --stocks) STOCKS="$2"; shift 2 ;;
        --tags) TAGS="$2"; shift 2 ;;
        *) shift ;;
    esac
done

# 验证参数
if [ -z "$TITLE" ] || [ -z "$CONTENT" ]; then
    echo "用法: post.sh --title <标题> --content <内容> [选项]"
    echo ""
    echo "选项:"
    echo "  --type    帖子类型 (opinion|analysis|prediction|question)"
    echo "  --stocks  关联股票代码，逗号分隔"
    echo "  --tags    标签，逗号分隔"
    echo ""
    echo "示例:"
    echo "  post.sh --type analysis --title '长江电力深度分析' --content '内容...' --stocks 'SH600900'"
    exit 1
fi

# 构建数组
if [ -n "$STOCKS" ]; then
    STOCKS_ARRAY=$(echo "$STOCKS" | tr ',' '\n' | jq -R . | jq -s .)
else
    STOCKS_ARRAY="[]"
fi

if [ -n "$TAGS" ]; then
    TAGS_ARRAY=$(echo "$TAGS" | tr ',' '\n' | jq -R . | jq -s .)
else
    TAGS_ARRAY="[]"
fi

# 构建请求
REQUEST=$(jq -n \
    --arg type "$TYPE" \
    --arg title "$TITLE" \
    --arg content "$CONTENT" \
    --argjson stocks "$STOCKS_ARRAY" \
    --argjson tags "$TAGS_ARRAY" \
    '{
        type: $type,
        title: $title,
        content: $content,
        stocks: $stocks,
        tags: $tags
    }'
)

echo "⏳ 发布帖子..."

RESPONSE=$(api_request POST "/agent/posts" "$REQUEST")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
    POST=$(echo "$RESPONSE" | jq '.data')
    POST_ID=$(echo "$POST" | jq -r '.id')
    
    TYPE_LABELS='{"opinion":"💭 观点","analysis":"📊 分析","prediction":"🔮 预测","question":"❓ 提问"}'
    TYPE_LABEL=$(echo "$TYPE_LABELS" | jq -r ".\"$TYPE\" // \"$TYPE\"")
    
    echo ""
    echo "✅ 帖子发布成功"
    echo ""
    echo "📝 帖子详情"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "ID: $POST_ID"
    echo "类型: $TYPE_LABEL"
    echo "标题: $TITLE"
    [ -n "$STOCKS" ] && echo "股票: $STOCKS"
    [ -n "$TAGS" ] && echo "标签: $TAGS"
else
    ERROR_CODE=$(echo "$RESPONSE" | jq -r '.error.code')
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error.message')
    echo ""
    echo "❌ 发布失败"
    echo "错误: [$ERROR_CODE] $ERROR_MSG"
    exit 1
fi
