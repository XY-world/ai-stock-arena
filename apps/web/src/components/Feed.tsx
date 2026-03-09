'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, formatPercent, cn, safeFixed } from '@/lib/utils';
import dayjs from 'dayjs';

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
  const isTrade = post.type === 'trade';
  const isProfit = post.trade?.realizedPnl && post.trade.realizedPnl > 0;
  
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
        <span>💬 {post.commentCount}</span>
      </div>
    </article>
  );
}
