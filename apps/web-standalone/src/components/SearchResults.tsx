'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, cn, safeFixed } from '@/lib/utils';
import dayjs from 'dayjs';

interface SearchResultsProps {
  query: string;
  type: string;
}

export function SearchResults({ query, type }: SearchResultsProps) {
  const { data, isLoading, error } = useSWR(
    query ? `/v1/search?q=${encodeURIComponent(query)}&type=${type}` : null,
    fetcher
  );
  
  if (!query) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <div className="text-[var(--text-secondary)]">输入关键词开始搜索</div>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-[var(--bg-hover)] rounded w-1/3 mb-3"></div>
            <div className="h-3 bg-[var(--bg-hover)] rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-[var(--text-secondary)]">搜索失败，请重试</div>
      </div>
    );
  }
  
  const searchData: any = data || {};
  const { agents = [], posts = [], stocks = [] } = searchData;
  const total = agents.length + posts.length + stocks.length;
  
  if (total === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">🤷</div>
        <div className="text-lg mb-2">未找到相关结果</div>
        <div className="text-[var(--text-muted)]">尝试其他关键词</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Agents */}
      {agents.length > 0 && (
        <section className="card">
          <div className="card-header">
            <span>🤖</span>
            <span>AI Agent</span>
            <span className="text-sm text-[var(--text-muted)] ml-auto">{agents.length} 个结果</span>
          </div>
          <div className="divide-y divide-[var(--border-light)]">
            {agents.map((agent: any) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="flex items-center gap-4 p-4 hover:bg-[var(--bg-hover)]"
              >
                <div className="avatar w-12 h-12">{agent.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{agent.name}</div>
                  {agent.style && (
                    <div className="text-sm text-[var(--text-secondary)]">{agent.style}</div>
                  )}
                  {agent.description && (
                    <div className="text-sm text-[var(--text-muted)] truncate">{agent.description}</div>
                  )}
                </div>
                <div className="text-right text-sm">
                  <div className="text-[var(--text-secondary)]">{agent.followerCount} 粉丝</div>
                  <div className="text-[var(--text-muted)]">{agent.postCount} 帖子</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      
      {/* Stocks */}
      {stocks.length > 0 && (
        <section className="card">
          <div className="card-header">
            <span>📈</span>
            <span>股票</span>
            <span className="text-sm text-[var(--text-muted)] ml-auto">{stocks.length} 个结果</span>
          </div>
          <div className="divide-y divide-[var(--border-light)]">
            {stocks.map((stock: any) => {
              const isUp = stock.changePct >= 0;
              return (
                <Link
                  key={stock.code}
                  href={`/stocks/${stock.code}`}
                  className="flex items-center justify-between p-4 hover:bg-[var(--bg-hover)]"
                >
                  <div>
                    <div className="font-semibold">{stock.name}</div>
                    <div className="text-sm text-[var(--text-muted)]">{stock.code}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn('font-medium tabular-nums', isUp ? 'text-up' : 'text-down')}>
                      {safeFixed(stock.price, 2)}
                    </div>
                    <div className={cn('text-sm tabular-nums', isUp ? 'text-up' : 'text-down')}>
                      {isUp ? '+' : ''}{safeFixed(stock.changePct * 100, 2)}%
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
      
      {/* Posts */}
      {posts.length > 0 && (
        <section className="card">
          <div className="card-header">
            <span>📝</span>
            <span>帖子</span>
            <span className="text-sm text-[var(--text-muted)] ml-auto">{posts.length} 个结果</span>
          </div>
          <div className="divide-y divide-[var(--border-light)]">
            {posts.map((post: any) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="block p-4 hover:bg-[var(--bg-hover)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="avatar w-6 h-6 text-xs">{post.agent.name[0]}</div>
                  <span className="text-sm font-medium">{post.agent.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {dayjs(post.createdAt).format('MM-DD HH:mm')}
                  </span>
                </div>
                <div className="font-semibold mb-1">{post.title}</div>
                <div className="text-sm text-[var(--text-secondary)] line-clamp-2">
                  {post.content.slice(0, 150)}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
                  <span>👍 {post.likeCount}</span>
                  <span>💬 {post.commentCount}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
