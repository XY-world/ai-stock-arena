'use client';

import useSWR from 'swr';
import { fetcher, cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useMarket, Market } from '@/contexts/MarketContext';

interface IndexData {
  name: string;
  code: string;
  price: number;
  changePct: number;
}

// 市场配置
const MARKETS: { id: Market; label: string; flag: string }[] = [
  { id: 'CN', label: 'A股', flag: '' },
  { id: 'HK', label: '港股', flag: '' },
  { id: 'US', label: '美股', flag: '' },
];

// 指数配置
const INDEX_CONFIG = {
  CN: {
    nameMap: {
      '上证指数': '上证',
      '深证成指': '深成',
      '创业板指': '创业板',
      '科创50': '科创50',
    },
    placeholder: ['上证', '深成', '创业板', '科创50'],
  },
  HK: {
    nameMap: {
      '恒生指数': '恒生',
      '恒生科技': '恒科',
      '国企指数': '国企',
    },
    placeholder: ['恒生', '恒科', '国企'],
  },
  US: {
    nameMap: {
      '道琼斯': '道指',
      '标普500': '标普',
      '纳斯达克': '纳指',
    },
    placeholder: ['道指', '标普', '纳指'],
  },
};

export function IndexBar() {
  const { market, setMarket } = useMarket();
  const { data: overview }: { data: any } = useSWR(
    `/v1/market/overview?market=${market}`,
    fetcher,
    { refreshInterval: 60000 }
  );
  const [time, setTime] = useState('');
  
  useEffect(() => {
    const updateTime = () => {
      // 北京/香港时间 (UTC+8)
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
  
  const config = INDEX_CONFIG[market];
  
  // 处理指数数据
  const indices: IndexData[] = [];
  if (overview?.indices) {
    for (const [name, data] of Object.entries(overview.indices)) {
      const d = data as any;
      const shortName = config.nameMap[name as keyof typeof config.nameMap];
      if (shortName) {
        indices.push({
          name: shortName,
          code: d.code,
          price: d.price,
          changePct: (d.changePct || 0) * 100,
        });
      }
    }
  }
  
  return (
    <div className="index-bar px-2 md:px-4 py-1 md:py-1.5 border-b border-[var(--border-color)] overflow-x-auto">
      <div className="max-w-7xl mx-auto flex items-center justify-between min-w-max md:min-w-0">
        {/* 市场切换 */}
        <div className="flex items-center gap-1 mr-3 md:mr-4">
          {MARKETS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMarket(m.id)}
              className={cn(
                'px-1.5 md:px-2 py-0.5 text-xs rounded transition-colors',
                market === m.id
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              )}
            >
              <span className="hidden md:inline mr-0.5">{m.flag}</span>
              {m.label}
            </button>
          ))}
        </div>
        
        {/* 指数数据 */}
        <div className="flex items-center gap-2 md:gap-6 flex-1">
          {indices.length > 0 ? (
            indices.map((idx) => (
              <IndexTicker key={idx.name} name={idx.name} value={idx.price} change={idx.changePct} />
            ))
          ) : (
            config.placeholder.map((name) => (
              <IndexTicker key={name} name={name} value={0} change={0} loading />
            ))
          )}
        </div>
        <div className="text-xs text-[var(--text-muted)] whitespace-nowrap ml-2 md:ml-4">
          {time}
        </div>
      </div>
    </div>
  );
}

function IndexTicker({ 
  name, 
  value, 
  change,
  loading = false,
}: { 
  name: string; 
  value: number; 
  change: number;
  loading?: boolean;
}) {
  const isUp = change >= 0;
  
  if (loading) {
    return (
      <div className="index-item flex items-center gap-1 whitespace-nowrap">
        <span className="index-name text-xs text-[var(--text-muted)]">{name}</span>
        <span className="text-xs md:text-sm text-[var(--text-muted)]">--</span>
      </div>
    );
  }
  
  return (
    <div className="index-item flex items-center gap-1 whitespace-nowrap">
      <span className="index-name text-xs text-[var(--text-muted)]">{name}</span>
      <span className={cn("text-xs md:text-sm font-medium tabular-nums", isUp ? 'text-up' : 'text-down')}>
        {value.toFixed(2)}
      </span>
      <span className={cn("text-xs tabular-nums hidden sm:inline", isUp ? 'text-up' : 'text-down')}>
        {isUp ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  );
}
