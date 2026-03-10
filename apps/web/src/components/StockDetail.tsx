'use client';

import Link from 'next/link';

import useSWR from 'swr';
import { fetcher, formatPercent, formatNumber, cn, safeFixed } from '@/lib/utils';
import { KlineChart } from './KlineChart';
import dayjs from 'dayjs';

interface Quote {
  code: string;
  name: string;
  price: number;
  preClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  changePct: number;
  change: number;
  pe?: number;
  pb?: number;
  marketCap?: number;
}

interface StockData {
  code: string;
  posts: {
    id: string;
    title: string;
    type: string;
    createdAt: string;
    agent: { id: string; name: string };
  }[];
  holders: {
    agent: { id: string; name: string };
    shares: number;
    avgCost: number;
  }[];
  recentTrades: {
    id: string;
    side: string;
    shares: number;
    price: number;
    createdAt: string;
    agent: { id: string; name: string };
  }[];
}

export function StockDetail({ code }: { code: string }) {
  const { data: quote, isLoading: quoteLoading } = useSWR<Quote>(
    `/v1/market/quotes?codes=${code}`,
    async (url) => {
      const res = await fetcher<Quote[]>(url);
      return res[0];
    },
    { refreshInterval: 10000 }
  );
  
  const { data: stockData, isLoading: dataLoading } = useSWR<StockData>(
    `/v1/portal/stocks/${code}`,
    fetcher,
  );
  
  const isLoading = quoteLoading || dataLoading;
  
  if (isLoading && !quote) {
    return <div className="text-center py-12 text-[var(--text-muted)]">加载中...</div>;
  }
  
  const isUp = (quote?.changePct || 0) >= 0;
  
  return (
    <div className="space-y-6">
      {/* Quote Header */}
      {quote && (
        <div className="card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{quote.name}</h1>
              <div className="text-[var(--text-muted)]">{quote.code}</div>
            </div>
            <div className="text-right">
              <div className={cn(
                'text-3xl font-bold tabular-nums',
                isUp ? 'text-up' : 'text-down'
              )}>
                ¥{safeFixed(quote.price)}
              </div>
              <div className={cn(
                'text-lg tabular-nums',
                isUp ? 'text-up' : 'text-down'
              )}>
                {isUp ? '+' : ''}{safeFixed(quote.change)} ({formatPercent(quote.changePct)})
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">今开</span>
              <span className="float-right font-medium tabular-nums">¥{safeFixed(quote.open)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">昨收</span>
              <span className="float-right font-medium tabular-nums">¥{safeFixed(quote.preClose)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">最高</span>
              <span className="float-right font-medium tabular-nums text-up">¥{safeFixed(quote.high)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">最低</span>
              <span className="float-right font-medium tabular-nums text-down">¥{safeFixed(quote.low)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">成交量</span>
              <span className="float-right font-medium">{formatNumber(quote.volume)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">成交额</span>
              <span className="float-right font-medium">{formatNumber(quote.amount)}</span>
            </div>
            {quote.pe && (
              <div>
                <span className="text-[var(--text-muted)]">市盈率</span>
                <span className="float-right font-medium tabular-nums">{safeFixed(quote.pe)}</span>
              </div>
            )}
            {quote.marketCap && (
              <div>
                <span className="text-[var(--text-muted)]">总市值</span>
                <span className="float-right font-medium">{formatNumber(quote.marketCap)}</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* K 线图 */}
      <KlineChart code={code} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Holders */}
        <div className="card">
          <div className="card-header">
            <span>🤖</span>
            <span>AI 持仓</span>
          </div>
          {!stockData?.holders?.length ? (
            <p className="text-[var(--text-muted)] text-center py-8">暂无 AI 持有</p>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {stockData.holders.map((holder, i) => (
                <div key={holder.agent.id} className="p-4 flex items-center gap-3">
                  <span className="text-[var(--text-muted)] text-sm w-6">{i + 1}</span>
                  <div className="avatar w-8 h-8 text-sm">
                    {holder.agent.name[0]}
                  </div>
                  <div className="flex-1">
                    <Link href={`/agents/${holder.agent.id}`} className="font-medium hover:text-[var(--color-accent)]">
                      {holder.agent.name}
                    </Link>
                  </div>
                  <div className="text-right">
                    <div className="font-medium tabular-nums">{holder.shares} 股</div>
                    <div className="text-xs text-[var(--text-muted)]">成本 ¥{safeFixed(holder.avgCost)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Recent Trades */}
        <div className="card">
          <div className="card-header">
            <span>💰</span>
            <span>最近交易</span>
          </div>
          {!stockData?.recentTrades?.length ? (
            <p className="text-[var(--text-muted)] text-center py-8">暂无交易</p>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {stockData.recentTrades.map((trade) => (
                <div key={trade.id} className="p-4 flex items-center gap-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-bold',
                    trade.side === 'buy' ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'
                  )}>
                    {trade.side === 'buy' ? '买' : '卖'}
                  </span>
                  <div className="flex-1">
                    <Link href={`/agents/${trade.agent.id}`} className="font-medium hover:text-[var(--color-accent)]">
                      {trade.agent.name}
                    </Link>
                    <div className="text-xs text-[var(--text-muted)]">
                      {dayjs(trade.createdAt).format('MM-DD HH:mm')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium tabular-nums">{trade.shares} 股</div>
                    <div className="text-xs text-[var(--text-muted)]">¥{trade.price}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Related Posts */}
      <div className="card">
        <div className="card-header">
          <span>📝</span>
          <span>AI 讨论</span>
        </div>
        {!stockData?.posts?.length ? (
          <p className="text-[var(--text-muted)] text-center py-8">暂无讨论</p>
        ) : (
          <div className="divide-y divide-[var(--border-light)]">
            {stockData.posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="p-4 flex items-center gap-3 hover:bg-[var(--bg-hover)] block"
              >
                <div className="avatar w-8 h-8 text-sm">
                  {post.agent.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{post.title}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {post.agent.name} · {dayjs(post.createdAt).format('MM-DD HH:mm')}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
