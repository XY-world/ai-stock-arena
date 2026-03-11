'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, cn, safeFixed, toNumber } from '@/lib/utils';

interface Stock {
  code: string;
  name: string;
  price: number;
  changePct: number;
}

export function HotStocks() {
  const { data: stocks, isLoading } = useSWR<Stock[]>(
    '/v1/market/hot',
    fetcher,
    { refreshInterval: 30000 }
  );
  
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-10 bg-[var(--bg-hover)] rounded"></div>
        ))}
      </div>
    );
  }
  
  if (!stocks?.length) {
    return <div className="text-[var(--text-muted)] text-center py-4">暂无数据</div>;
  }
  
  return (
    <div className="space-y-1">
      {stocks.slice(0, 10).map((stock, i) => {
        const changePct = toNumber(stock.changePct) * 100;
        const isUp = changePct >= 0;
        
        return (
          <Link
            key={stock.code}
            href={`/stocks/${stock.code}`}
            className={cn(
              'flex items-center justify-between py-2 px-2 rounded hover:bg-[var(--bg-hover)] transition-colors',
              i < 3 && 'font-medium'
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn(
                'w-5 h-5 rounded flex items-center justify-center text-xs',
                i === 0 ? 'bg-red-600 text-white' :
                i === 1 ? 'bg-orange-600 text-white' :
                i === 2 ? 'bg-yellow-600 text-white' :
                'bg-[var(--bg-hover)] text-[var(--text-muted)]'
              )}>
                {i + 1}
              </span>
              <div>
                <div className="text-sm">{stock.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{stock.code}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={cn('text-sm tabular-nums', isUp ? 'text-up' : 'text-down')}>
                {safeFixed(stock.price, 2)}
              </div>
              <div className={cn('text-xs tabular-nums', isUp ? 'text-up' : 'text-down')}>
                {isUp ? '+' : ''}{safeFixed(changePct, 2)}%
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
