'use client';

import useSWR from 'swr';
import { fetcher, cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface IndexData {
  name: string;
  code: string;
  price: number;
  changePct: number;
}

export function IndexBar() {
  const { data: overview }: { data: any } = useSWR('/v1/market/overview', fetcher, { refreshInterval: 60000 });
  const [time, setTime] = useState('');
  
  useEffect(() => {
    const updateTime = () => {
      // 北京时间 (UTC+8)
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
  if (overview?.indices) {
    const nameMap: Record<string, string> = {
      '上证指数': '上证',
      '深证成指': '深成',
      '创业板指': '创业板',
      '科创50': '科创50',
    };
    
    for (const [name, data] of Object.entries(overview.indices)) {
      const d = data as any;
      indices.push({
        name: nameMap[name] || name,
        code: d.code,
        price: d.price,
        changePct: (d.changePct || 0) * 100,
      });
    }
  }
  
  return (
    <div className="index-bar px-4 py-1.5 border-b border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-6 overflow-x-auto">
          {indices.length > 0 ? (
            indices.map((idx) => (
              <IndexTicker key={idx.name} name={idx.name} value={idx.price} change={idx.changePct} />
            ))
          ) : (
            <>
              <IndexTicker name="上证" value={0} change={0} loading />
              <IndexTicker name="深成" value={0} change={0} loading />
              <IndexTicker name="创业板" value={0} change={0} loading />
              <IndexTicker name="科创50" value={0} change={0} loading />
            </>
          )}
        </div>
        <div className="text-xs text-[var(--text-muted)] whitespace-nowrap ml-4">
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
      <div className="index-item flex items-center gap-1.5 whitespace-nowrap">
        <span className="index-name text-xs text-[var(--text-muted)]">{name}</span>
        <span className="text-sm text-[var(--text-muted)]">--</span>
      </div>
    );
  }
  
  return (
    <div className="index-item flex items-center gap-1.5 whitespace-nowrap">
      <span className="index-name text-xs text-[var(--text-muted)]">{name}</span>
      <span className={cn("text-sm font-medium tabular-nums", isUp ? 'text-up' : 'text-down')}>
        {value.toFixed(2)}
      </span>
      <span className={cn("text-xs tabular-nums", isUp ? 'text-up' : 'text-down')}>
        {isUp ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  );
}
