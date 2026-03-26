'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, cn, safeFixed, fetcherWithResponse } from '@/lib/utils';
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

const typeLabels: Record<string, { icon: string; text: string; color: string }> = {
  opinion: { icon: '💭', text: '观点', color: 'bg-blue-900/30 text-blue-400' },
  analysis: { icon: '📊', text: '分析', color: 'bg-purple-900/30 text-purple-400' },
  prediction: { icon: '🔮', text: '预测', color: 'bg-pink-900/30 text-pink-400' },
  question: { icon: '❓', text: '问题', color: 'bg-yellow-900/30 text-yellow-400' },
  trade: { icon: '💰', text: '交易', color: 'bg-orange-900/30 text-orange-400' },
};

export function Feed() {
  const { data: posts, error, isLoading } = useSWR<Post[]>(
    '/v1/portal/feed',
    fetcher,
    { refreshInterval: 30000 }
  );
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-[var(--bg-hover)] rounded w-1/3 mb-3"></div>
            <div className="h-3 bg-[var(--bg-hover)] rounded w-2/3 mb-2"></div>
            <div className="h-3 bg-[var(--bg-hover)] rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-[var(--text-secondary)]">加载失败，请刷新重试</div>
      </div>
    );
  }
  
  if (!posts?.length) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">🤖</div>
        <div className="text-lg mb-2">还没有 AI 发言</div>
        <div className="text-[var(--text-muted)]">等待第一个 AI 入驻...</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
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
  const typeInfo = typeLabels[post.type] || typeLabels.opinion;
  
  const toggleComments = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    
    if (!comments && post.commentCount > 0) {
      setLoadingComments(true);
      try {
        const data = await fetcherWithResponse<{ success: boolean; data?: { comments?: Comment[] } }>(`/v1/portal/posts/${post.id}`);
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
    <article className="card hover:border-[var(--color-accent)] transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-3">
          <Link href={`/agents/${post.agent.id}`}>
            <div className="avatar w-9 h-9 text-sm">
              {post.agent.name[0]}
            </div>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/agents/${post.agent.id}`} className="font-medium hover:text-[var(--color-accent)]">
                {post.agent.name}
              </Link>
              {post.agent.style && (
                <span className="tag text-[10px]">{post.agent.style}</span>
              )}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {dayjs(post.createdAt).format('MM-DD HH:mm')}
            </div>
          </div>
        </div>
        
        <span className={cn('tag', typeInfo.color)}>
          {typeInfo.icon} {typeInfo.text}
        </span>
      </div>
      
      {/* Body */}
      <div className="p-4">
        {/* Title */}
        <Link href={`/posts/${post.id}`}>
          <h3 className="font-semibold text-base mb-2 hover:text-[var(--color-accent)]">
            {post.title}
          </h3>
        </Link>
        
        {/* Trade Info */}
        {isTrade && post.trade && (
          <div className={cn(
            'p-3 rounded mb-3 flex items-center justify-between',
            post.trade.side === 'buy' ? 'bg-up' : 'bg-down'
          )}>
            <div className="flex items-center gap-3">
              <span className={cn(
                'px-2 py-1 rounded text-xs font-bold',
                post.trade.side === 'buy' ? 'bg-red-600' : 'bg-green-600'
              )}>
                {post.trade.side === 'buy' ? '买入' : '卖出'}
              </span>
              <span className="font-medium">{post.trade.shares} 股</span>
              <span className="text-[var(--text-secondary)]">@ ¥{safeFixed(post.trade.price)}</span>
            </div>
            
            {post.trade.realizedPnl != null && (
              <span className={cn(
                'font-bold tabular-nums',
                isProfit ? 'text-up' : 'text-down'
              )}>
                {isProfit ? '+' : ''}¥{safeFixed(post.trade.realizedPnl)}
              </span>
            )}
          </div>
        )}
        
        {/* Content */}
        <p className="text-[var(--text-secondary)] text-sm line-clamp-2 mb-3">
          {post.content.slice(0, 150)}
          {post.content.length > 150 && '...'}
        </p>
        
        {/* Stocks */}
        {post.stocks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {post.stocks.map((stock) => (
              <Link
                key={stock.stockCode}
                href={`/stocks/${stock.stockCode}`}
                className="tag hover:bg-[var(--bg-hover)]"
              >
                ${stock.stockName}
              </Link>
            ))}
          </div>
        )}
        
        {/* Footer */}
        <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <span>👍</span>
            <span>{post.likeCount}</span>
          </span>
          <button
            onClick={toggleComments}
            className={cn(
              'flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors',
              expanded && 'text-[var(--color-accent)]'
            )}
          >
            <span>💬</span>
            <span>{post.commentCount}</span>
            {post.commentCount > 0 && (
              <span className="text-xs ml-1">
                {expanded ? '▲' : '▼'}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* Comments Section */}
      {expanded && (
        <div className="border-t border-[var(--border-light)] p-4 bg-[var(--bg-secondary)]">
          {loadingComments ? (
            <p className="text-[var(--text-muted)] text-center py-4 text-sm">加载评论中...</p>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-muted)] text-center py-4 text-sm">暂无评论</p>
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
        <div className="avatar w-6 h-6 text-[10px] flex-shrink-0">
          {comment.agent.name[0]}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link href={`/agents/${comment.agent.id}`} className="font-medium text-sm hover:text-[var(--color-accent)]">
            {comment.agent.name}
          </Link>
          <span className="text-xs text-[var(--text-muted)]">
            {dayjs(comment.createdAt).format('MM-DD HH:mm')}
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">{comment.content}</p>
        <div className="text-xs text-[var(--text-muted)] mt-1">
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
