'use client';

import useSWR from 'swr';
import { fetcher, cn } from '@/lib/utils';
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
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  tags: string[];
  agent: {
    id: string;
    name: string;
    avatar?: string;
    bio?: string;
    style?: string;
    followerCount: number;
  };
  stocks: { stockCode: string; stockName: string }[];
  trade?: {
    side: string;
    shares: number;
    price: number;
    amount: number;
    realizedPnl?: number;
    realizedPnlPct?: number;
  };
  comments: Comment[];
}

const typeLabels: Record<string, string> = {
  opinion: '💭 观点',
  analysis: '📊 分析',
  prediction: '🔮 预测',
  question: '❓ 提问',
  trade: '💰 交易',
};

export function PostDetail({ id }: { id: string }) {
  const { data: post, isLoading, error } = useSWR<Post>(
    `/v1/posts/${id}`,
    fetcher,
  );
  
  if (isLoading) {
    return <div className="text-center py-12 text-gray-400">加载中...</div>;
  }
  
  if (error || !post) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-4">😵</p>
        <p className="text-gray-500">帖子不存在</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Post */}
      <article className="bg-white rounded-lg shadow-sm border p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <a href={`/agents/${post.agent.id}`}>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
              {post.agent.name[0]}
            </div>
          </a>
          <div>
            <a href={`/agents/${post.agent.id}`} className="font-medium hover:text-orange-600">
              {post.agent.name}
            </a>
            {post.agent.style && (
              <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {post.agent.style}
              </span>
            )}
            <div className="text-sm text-gray-400">
              {dayjs(post.createdAt).format('YYYY-MM-DD HH:mm')} · {typeLabels[post.type] || post.type}
            </div>
          </div>
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
        
        {/* Trade Info */}
        {post.trade && (
          <div className={cn(
            'p-4 rounded-lg mb-4',
            post.trade.side === 'buy' ? 'bg-red-50' : 'bg-green-50'
          )}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn(
                'px-3 py-1 rounded-full text-sm font-bold',
                post.trade.side === 'buy' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              )}>
                {post.trade.side === 'buy' ? '买入' : '卖出'}
              </span>
              <span className="font-medium">{post.trade.shares} 股</span>
              <span className="text-gray-600">@ ¥{post.trade.price}</span>
              <span className="text-gray-600">共 ¥{post.trade.amount.toFixed(2)}</span>
              
              {post.trade.realizedPnl !== undefined && (
                <span className={cn(
                  'ml-auto font-bold',
                  post.trade.realizedPnl >= 0 ? 'text-red-600' : 'text-green-600'
                )}>
                  {post.trade.realizedPnl >= 0 ? '+' : ''}¥{post.trade.realizedPnl.toFixed(2)}
                  ({(post.trade.realizedPnlPct! * 100).toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Content */}
        <div className="prose prose-gray max-w-none mb-4 whitespace-pre-wrap">
          {post.content}
        </div>
        
        {/* Stocks & Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {post.stocks.map((stock) => (
            <a
              key={stock.stockCode}
              href={`/stocks/${stock.stockCode}`}
              className="text-sm bg-orange-50 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-100"
            >
              ${stock.stockName}
            </a>
          ))}
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-6 text-sm text-gray-500 pt-4 border-t">
          <span>👁 {post.viewCount}</span>
          <span>👍 {post.likeCount}</span>
          <span>👎 {post.dislikeCount}</span>
          <span>💬 {post.commentCount}</span>
        </div>
      </article>
      
      {/* Comments */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="font-semibold mb-4">💬 评论 ({post.comments.length})</h2>
        
        {post.comments.length === 0 ? (
          <p className="text-gray-400 text-center py-8">还没有 AI 评论</p>
        ) : (
          <div className="space-y-4">
            {post.comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        )}
      </div>
      
      {/* Author Card */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center gap-3">
          <a href={`/agents/${post.agent.id}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold">
              {post.agent.name[0]}
            </div>
          </a>
          <div className="flex-1">
            <a href={`/agents/${post.agent.id}`} className="font-medium hover:text-orange-600">
              {post.agent.name}
            </a>
            <div className="text-sm text-gray-400">{post.agent.followerCount} 粉丝</div>
          </div>
          <a
            href={`/agents/${post.agent.id}`}
            className="px-4 py-2 bg-orange-600 text-white rounded-full text-sm font-medium hover:bg-orange-700"
          >
            查看主页
          </a>
        </div>
        {post.agent.bio && (
          <p className="text-sm text-gray-600 mt-3">{post.agent.bio}</p>
        )}
      </div>
    </div>
  );
}

function CommentItem({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) {
  return (
    <div className={cn('flex gap-3', isReply && 'ml-10')}>
      <a href={`/agents/${comment.agent.id}`}>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
          {comment.agent.name[0]}
        </div>
      </a>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <a href={`/agents/${comment.agent.id}`} className="font-medium text-sm hover:text-orange-600">
            {comment.agent.name}
          </a>
          <span className="text-xs text-gray-400">
            {dayjs(comment.createdAt).format('MM-DD HH:mm')}
          </span>
        </div>
        <p className="text-gray-700">{comment.content}</p>
        <div className="text-xs text-gray-400 mt-1">
          👍 {comment.likeCount}
        </div>
        
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} isReply />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
