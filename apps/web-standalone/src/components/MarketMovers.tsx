'use client';

import useSWR from 'swr';
import { fetcher, cn, safeFixed } from '@/lib/utils';
import { useMarket } from '@/contexts/MarketContext';

interface Mover {
  code: string;
  name: string;
  price: number;
  change_pct: number;
  amount?: number;
  amount_formatted?: string;
  volume?: number;
}

interface MoversData {
  gainers: Mover[];
  losers: Mover[];
  volume?: Mover[];
  chinaConcept?: Mover[];
}

export function MarketMovers() {
  const { market, marketLabel, marketFlag } = useMarket();
  
  const { data, isLoading, error } = useSWR<{ success: boolean; data: MoversData }>(
    `/v1/market/movers?market=${market}&limit=10`,
    fetcher,
    { refreshInterval: 120000 }
  );
  
  const movers = data?.data;
  
  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <span>📈</span>
          <span>{marketFlag} 涨跌榜</span>
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 bg-[var(--bg-hover)] rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }
  
  if (error || !movers) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">📊</div>
        <div className="text-[var(--text-secondary)]">榜单数据加载中...</div>
      </div>
    );
  }
  
  const formatCode = (code: string) => {
    // 美股去掉 US 前缀
    if (code.startsWith('US')) return code.slice(2);
    return code;
  };
  
  const formatChange = (pct: number) => {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${safeFixed(pct, 2)}%`;
  };
  
  return (
    <div className="card">
      <div className="card-header border-b border-[var(--border-light)]">
        <span>📈</span>
        <span>{marketFlag} 涨跌榜</span>
      </div>
      
      <div className="grid grid-cols-2 divide-x divide-[var(--border-light)]">
        {/* 涨幅榜 */}
        <div className="p-3">
          <div className="text-sm font-medium text-up mb-2">🔴 涨幅榜</div>
          <div className="space-y-1">
            {movers.gainers.slice(0, 5).map((stock, i) => (
              <div key={stock.code} className="flex items-center gap-2 py-1 text-sm">
                <span className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold',
                  i < 3 ? 'bg-red-500 text-white' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                )}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{stock.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{formatCode(stock.code)}</div>
                </div>
                <div className="text-right">
                  <div className="text-up font-bold tabular-nums">{formatChange(stock.change_pct)}</div>
                  {stock.price > 0 && (
                    <div className="text-xs text-[var(--text-muted)] tabular-nums">
                      {market === 'US' ? '$' : market === 'HK' ? 'HK$' : '¥'}{stock.price.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* 跌幅榜 */}
        <div className="p-3">
          <div className="text-sm font-medium text-down mb-2">🟢 跌幅榜</div>
          <div className="space-y-1">
            {movers.losers.slice(0, 5).map((stock, i) => (
              <div key={stock.code} className="flex items-center gap-2 py-1 text-sm">
                <span className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold',
                  i < 3 ? 'bg-green-500 text-white' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                )}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{stock.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{formatCode(stock.code)}</div>
                </div>
                <div className="text-right">
                  <div className="text-down font-bold tabular-nums">{formatChange(stock.change_pct)}</div>
                  {stock.price > 0 && (
                    <div className="text-xs text-[var(--text-muted)] tabular-nums">
                      {market === 'US' ? '$' : market === 'HK' ? 'HK$' : '¥'}{stock.price.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* 成交额榜 (港股) 或 中概股 (美股) */}
      {(movers.volume || movers.chinaConcept) && (
        <div className="border-t border-[var(--border-light)] p-3">
          <div className="text-sm font-medium mb-2">
            {movers.chinaConcept ? '🇨🇳 中概股' : '💰 成交额榜'}
          </div>
          <div className="space-y-1">
            {(movers.chinaConcept || movers.volume || []).slice(0, 5).map((stock, i) => (
              <div key={stock.code} className="flex items-center gap-2 py-1 text-sm">
                <span className="w-4 text-center text-xs text-[var(--text-muted)]">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{stock.name}</span>
                </div>
                <div className={cn(
                  'font-bold tabular-nums',
                  stock.change_pct >= 0 ? 'text-up' : 'text-down'
                )}>
                  {formatChange(stock.change_pct)}
                </div>
                {stock.amount_formatted && (
                  <div className="text-xs text-[var(--text-muted)] w-16 text-right">
                    {stock.amount_formatted}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
