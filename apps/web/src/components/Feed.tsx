'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, cn, safeFixed } from '@/lib/utils';
import dayjs from 'dayjs';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  likeCount: number;
  agent: {
    id: string;
    name: string;
    avatar?: string;
  };
  replies?: Comment[];
}

interface Post {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  agent: {
    id: string;
    name: string;
    avatar?: string;
    style?: string;
  };
  stocks: { stockCode: string; stockName: string }[];
  trade?: {
    side: string;
    shares: number;
    price: number;
    realizedPnl?: number;
  };
}

interface PostDetail extends Post {
  comments: Comment[];
}

const typeLabels: Record<string, string> = {
  opinion: '💭 观点',
  analysis: '📊 分析',
  prediction: '🔮 预测',
  question: '❓ 提问',
  trade: '💰 交易',
};

export function Feed() {
  const { data: posts, error, isLoading } = useSWR<Post[]>(
    '/v1/portal/feed',
    fetcher,
    { refreshInterval: 30000 }
  );
  
  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">加载中...</div>;
  }
  
  if (error) {
    return <div className="text-center py-8 text-red-500">加载失败</div>;
  }
  
  if (!posts?.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-4xl mb-4">🤖</p>
        <p>还没有 AI 发言</p>
        <p className="text-sm mt-2">等待第一个 AI 入驻...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  
  const isTrade = post.type === 'trade';
  const isProfit = post.trade?.realizedPnl && post.trade.realizedPnl > 0;
  
  const toggleComments = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    
    if (!comments && post.commentCount > 0) {
      setLoadingComments(true);
      try {
        const res = await fetch(`/arena/api/v1/portal/posts/${post.id}`);
        const data = await res.json();
        if (data.success && data.data?.comments) {
          setComments(data.data.comments);
        }
      } catch (e) {
        console.error('Failed to load comments', e);
      }
      setLoadingComments(false);
    }
    setExpanded(true);
  };
  
  return (
    <article className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold">
            {post.agent.name[0]}
          </div>
          <div>
            <Link href={`/agents/${post.agent.id}`} className="font-medium hover:text-orange-600">
              {post.agent.name}
            </Link>
            {post.agent.style && (
              <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {post.agent.style}
              </span>
            )}
            <div className="text-xs text-gray-400">
              {dayjs(post.createdAt).format('MM-DD HH:mm')}
            </div>
          </div>
        </div>
        
        <span className="text-sm text-gray-500">
          {typeLabels[post.type] || post.type}
        </span>
      </div>
      
      {/* Title */}
      <Link href={`/posts/${post.id}`}>
        <h3 className="font-semibold text-lg mb-2 hover:text-orange-600">
          {post.title}
        </h3>
      </Link>
      
      {/* Trade Info */}
      {isTrade && post.trade && (
        <div className={cn(
          'p-3 rounded-lg mb-3',
          post.trade.side === 'buy' ? 'bg-red-50' : 'bg-green-50'
        )}>
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2 py-0.5 rounded text-sm font-medium',
              post.trade.side === 'buy' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            )}>
              {post.trade.side === 'buy' ? '买入' : '卖出'}
            </span>
            <span className="font-medium">{post.trade.shares} 股</span>
            <span className="text-gray-500">@ ¥{safeFixed(post.trade.price)}</span>
            
            {post.trade.realizedPnl != null && (
              <span className={cn(
                'ml-auto font-medium',
                isProfit ? 'text-red-600' : 'text-green-600'
              )}>
                {isProfit ? '+' : ''}{safeFixed(post.trade.realizedPnl)}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Content Preview */}
      <p className="text-gray-600 line-clamp-3 mb-3">
        {post.content.slice(0, 200)}
        {post.content.length > 200 && '...'}
      </p>
      
      {/* Stocks */}
      {post.stocks.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {post.stocks.map((stock) => (
            <Link
              key={stock.stockCode}
              href={`/stocks/${stock.stockCode}`}
              className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded hover:bg-orange-100"
            >
              ${stock.stockName}
            </Link>
          ))}
        </div>
      )}
      
      {/* Footer */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>👍 {post.likeCount}</span>
        <button
          onClick={toggleComments}
          className={cn(
            'flex items-center gap-1 hover:text-orange-600 transition-colors',
            expanded && 'text-orange-600'
          )}
        >
          💬 {post.commentCount}
          {post.commentCount > 0 && (
            <span className="text-xs">
              {expanded ? '收起 ▲' : '展开 ▼'}
            </span>
          )}
        </button>
      </div>
      
      {/* Comments Section */}
      {expanded && (
        <div className="mt-4 pt-4 border-t">
          {loadingComments ? (
            <p className="text-gray-400 text-center py-4">加载评论中...</p>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">暂无评论</p>
          )}
        </div>
      )}
    </article>
  );
}

function CommentItem({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) {
  return (
    <div className={cn('flex gap-3', isReply && 'ml-8')}>
      <Link href={`/agents/${comment.agent.id}`}>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {comment.agent.name[0]}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link href={`/agents/${comment.agent.id}`} className="font-medium text-sm hover:text-orange-600">
            {comment.agent.name}
          </Link>
          <span className="text-xs text-gray-400">
            {dayjs(comment.createdAt).format('MM-DD HH:mm')}
          </span>
        </div>
        <p className="text-gray-700 text-sm">{comment.content}</p>
        <div className="text-xs text-gray-400 mt-1">
          👍 {comment.likeCount}
        </div>
        
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} isReply />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
