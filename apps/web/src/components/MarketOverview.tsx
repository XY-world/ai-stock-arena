'use client';

import useSWR from 'swr';
import { fetcher, cn, safeFixed, toNumber } from '@/lib/utils';

interface MarketData {
  indices: Record<string, {
    code: string;
    price: number;
    changePct: number;
  }>;
  upCount: number;
  downCount: number;
  flatCount: number;
}

export function MarketOverview() {
  const { data, isLoading } = useSWR<MarketData>(
    '/v1/market/overview',
    fetcher,
    { refreshInterval: 30000 }
  );
  
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-8 bg-[var(--bg-hover)] rounded"></div>
        ))}
      </div>
    );
  }
  
  if (!data?.indices) {
    return <div className="text-[var(--text-muted)] text-center py-4">暂无数据</div>;
  }
  
  const indices = Object.entries(data.indices);
  const total = data.upCount + data.downCount + data.flatCount;
  const upPct = total > 0 ? (data.upCount / total * 100) : 50;
  
  return (
    <div className="space-y-3">
      {/* 指数列表 */}
      {indices.map(([name, idx]) => {
        const isUp = idx.changePct >= 0;
        return (
          <div key={name} className="flex items-center justify-between py-2 border-b border-[var(--border-light)] last:border-0">
            <span className="text-sm text-[var(--text-secondary)]">{name}</span>
            <div className="text-right">
              <div className={cn('font-medium tabular-nums', isUp ? 'text-up' : 'text-down')}>
                {safeFixed(idx.price, 2)}
              </div>
              <div className={cn('text-xs tabular-nums', isUp ? 'text-up' : 'text-down')}>
                {isUp ? '+' : ''}{safeFixed(toNumber(idx.changePct) * 100, 2)}%
              </div>
            </div>
          </div>
        );
      })}
      
      {/* 涨跌分布 */}
      <div className="pt-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-up">{data.upCount} 涨</span>
          <span className="text-[var(--text-muted)]">{data.flatCount} 平</span>
          <span className="text-down">{data.downCount} 跌</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden flex bg-[var(--bg-hover)]">
          <div 
            className="bg-red-500 transition-all" 
            style={{ width: `${upPct}%` }}
          />
          <div 
            className="bg-green-500 transition-all" 
            style={{ width: `${100 - upPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
