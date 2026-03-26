'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { fetcher, cn, safeFixed, toNumber } from '@/lib/utils';
import { useMarket, Market } from '@/contexts/MarketContext';
import { useEffect, useState } from 'react';

// 市场配置
const MARKETS: { id: Market; label: string; flag: string; active: boolean }[] = [
  { id: 'CN', label: 'A股', flag: '', active: true },
  { id: 'HK', label: '港股', flag: '', active: false },
  { id: 'US', label: '美股', flag: '', active: false },
];

const MARKET_RULES: Record<Market, { settlement: string; limit: string; hours: string }> = {
  CN: { settlement: 'T+1', limit: '±10%', hours: '9:30-15:00' },
  HK: { settlement: 'T+0', limit: '无涨跌停', hours: '9:30-16:00' },
  US: { settlement: 'T+0', limit: '无涨跌停', hours: '21:30-04:00' },
};

// 指数名称映射
const INDEX_NAMES: Record<Market, Record<string, string>> = {
  CN: { '上证指数': '上证', '深证成指': '深成', '创业板指': '创业板', '科创50': '科创50' },
  HK: { '恒生指数': '恒生', '恒生科技': '恒科', '国企指数': '国企' },
  US: { '道琼斯': '道指', '标普500': '标普', '纳斯达克': '纳指' },
};

interface IndexData {
  name: string;
  price: number;
  changePct: number;
}

export function MarketPanel() {
  const { market, setMarket } = useMarket();
  const [time, setTime] = useState('');
  
  const { data: overview } = useSWR<any>(
    `/v1/market/overview?market=${market}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  
  // 更新时间
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));
      const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
      const day = String(beijingTime.getDate()).padStart(2, '0');
      const hour = String(beijingTime.getHours()).padStart(2, '0');
      const minute = String(beijingTime.getMinutes()).padStart(2, '0');
      setTime(`${month}/${day} ${hour}:${minute}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);
  
  // 处理指数数据
  const indices: IndexData[] = [];
  const nameMap = INDEX_NAMES[market];
  if (overview?.indices) {
    for (const [name, data] of Object.entries(overview.indices)) {
      const d = data as any;
      const shortName = nameMap[name];
      if (shortName) {
        indices.push({
          name: shortName,
          price: d.price,
          changePct: (d.changePct || 0) * 100,
        });
      }
    }
  }
  
  const rules = MARKET_RULES[market];
  const marketConfig = MARKETS.find(m => m.id === market)!;
  const upCount = overview?.upCount || 0;
  const downCount = overview?.downCount || 0;
  const flatCount = overview?.flatCount || 0;
  const total = upCount + downCount + flatCount;
  const upPct = total > 0 ? (upCount / total * 100) : 50;
  
  return (
    <div className="card overflow-hidden">
      {/* 市场切换器 */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-light)]">
        <div className="flex items-center gap-1">
          {MARKETS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMarket(m.id)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                market === m.id
                  ? 'bg-[var(--color-accent)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
                !m.active && market !== m.id && 'opacity-60'
              )}
            >
              <span className="mr-1">{m.flag}</span>
              {m.label}
              {!m.active && <span className="ml-1 text-xs opacity-70">(即将)</span>}
            </button>
          ))}
        </div>
        <div className="text-xs text-[var(--text-muted)]">{time}</div>
      </div>
      
      {/* 市场概况内容 */}
      <div className="p-4">
        {/* 指数卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
          {indices.length > 0 ? (
            indices.map((idx) => {
              const isUp = idx.changePct >= 0;
              return (
                <div 
                  key={idx.name}
                  className={cn(
                    'p-3 rounded-lg border',
                    isUp 
                      ? 'bg-red-500/5 border-red-500/20' 
                      : 'bg-green-500/5 border-green-500/20'
                  )}
                >
                  <div className="text-xs text-[var(--text-muted)] mb-1">{idx.name}</div>
                  <div className={cn('text-lg font-bold tabular-nums', isUp ? 'text-up' : 'text-down')}>
                    {safeFixed(idx.price, 2)}
                  </div>
                  <div className={cn('text-sm tabular-nums', isUp ? 'text-up' : 'text-down')}>
                    {isUp ? '+' : ''}{safeFixed(idx.changePct, 2)}%
                  </div>
                </div>
              );
            })
          ) : (
            // 占位符
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-[var(--border-light)] bg-[var(--bg-secondary)]">
                <div className="h-4 w-12 bg-[var(--bg-hover)] rounded animate-pulse mb-2"></div>
                <div className="h-6 w-20 bg-[var(--bg-hover)] rounded animate-pulse mb-1"></div>
                <div className="h-4 w-16 bg-[var(--bg-hover)] rounded animate-pulse"></div>
              </div>
            ))
          )}
        </div>
        
        {/* 涨跌分布 */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-up font-medium">{upCount} 涨</span>
            <span className="text-[var(--text-muted)]">{flatCount} 平</span>
            <span className="text-down font-medium">{downCount} 跌</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-[var(--bg-hover)]">
            <div className="bg-red-500 transition-all" style={{ width: `${upPct}%` }} />
            <div className="bg-green-500 transition-all" style={{ width: `${100 - upPct}%` }} />
          </div>
        </div>
        
        {/* 交易规则 */}
        <div className="flex items-center justify-center gap-4 text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-light)]">
          <span>{marketConfig.flag} {marketConfig.label}</span>
          <span>·</span>
          <span>{rules.settlement}</span>
          <span>·</span>
          <span>{rules.limit}</span>
          <span>·</span>
          <span>{rules.hours}</span>
        </div>
      </div>
    </div>
  );
}
