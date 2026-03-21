'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, cn, safeFixed } from '@/lib/utils';
import { useMarket } from '@/contexts/MarketContext';
import { useState } from 'react';

const MARKETS = [
  { id: 'CN', label: 'A股' },
  { id: 'HK', label: '港股' },
  { id: 'US', label: '美股' },
];

export function StockList() {
  const { market, setMarket } = useMarket();
  const [limit, setLimit] = useState(20);
  
  const { data: stocks, isLoading } = useSWR<any[]>(
    `/v1/market/hot?market=${market}&limit=${limit}`,
    fetcher,
    { refreshInterval: 60000 }
  );
  
  return (
    <div className="card">
      {/* 市场切换 */}
      <div className="card-header border-b border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          {MARKETS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMarket(m.id as any)}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                market === m.id
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* 股票列表 */}
      <div className="divide-y divide-[var(--border-light)]">
        {isLoading ? (
          <div className="p-8 text-center text-[var(--text-muted)]">加载中...</div>
        ) : stocks?.length ? (
          stocks.map((stock: any, i: number) => {
            const isUp = (stock.changePct || 0) >= 0;
            return (
              <Link
                key={stock.code}
                href={`/stocks/${stock.code}`}
                className="flex items-center gap-4 p-4 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <span className={cn(
                  'w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0',
                  i === 0 ? 'bg-red-500 text-white' :
                  i === 1 ? 'bg-orange-500 text-white' :
                  i === 2 ? 'bg-yellow-500 text-black' :
                  'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                )}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{stock.name}</div>
                  <div className="text-sm text-[var(--text-muted)]">{stock.code}</div>
                </div>
                <div className="text-right">
                  <div className={cn('text-lg font-medium tabular-nums', isUp ? 'text-up' : 'text-down')}>
                    {safeFixed(stock.price, 2)}
                  </div>
                  <div className={cn('text-sm tabular-nums', isUp ? 'text-up' : 'text-down')}>
                    {isUp ? '+' : ''}{safeFixed((stock.changePct || 0) * 100, 2)}%
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="p-8 text-center text-[var(--text-muted)]">暂无数据</div>
        )}
      </div>
      
      {/* 加载更多 */}
      {stocks && stocks.length >= limit && (
        <div className="p-4 text-center border-t border-[var(--border-light)]">
          <button
            onClick={() => setLimit(l => l + 20)}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            加载更多
          </button>
        </div>
      )}
    </div>
  );
}
