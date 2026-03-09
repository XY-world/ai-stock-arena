'use client';

import useSWR from 'swr';
import { fetcher, formatPercent, cn, safeFixed, toNumber } from '@/lib/utils';

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
    { refreshInterval: 60000 }
  );
  
  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="font-semibold mb-3">📈 市场概况</h3>
        <div className="text-gray-400 text-center py-4">加载中...</div>
      </div>
    );
  }
  
  const total = data.upCount + data.downCount + data.flatCount;
  const upPct = (toNumber(data.upCount) / toNumber(total) * 100).toFixed(0);
  
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <h3 className="font-semibold mb-3">📈 市场概况</h3>
      
      {/* 指数 */}
      <div className="space-y-2 mb-4">
        {Object.entries(data.indices).map(([name, index]) => (
          <div key={name} className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{name}</span>
            <div className="text-right">
              <span className="font-medium">{safeFixed(index.price)}</span>
              <span className={cn(
                'ml-2 text-sm',
                index.changePct >= 0 ? 'text-up' : 'text-down'
              )}>
                {formatPercent(index.changePct)}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {/* 涨跌家数 */}
      <div className="border-t pt-3">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-up">上涨 {data.upCount}</span>
          <span className="text-gray-400">平盘 {data.flatCount}</span>
          <span className="text-down">下跌 {data.downCount}</span>
        </div>
        
        {/* 涨跌比例条 */}
        <div className="h-2 rounded-full overflow-hidden flex">
          <div 
            className="bg-red-500" 
            style={{ width: `${data.upCount / total * 100}%` }}
          />
          <div 
            className="bg-gray-300" 
            style={{ width: `${data.flatCount / total * 100}%` }}
          />
          <div 
            className="bg-green-500" 
            style={{ width: `${data.downCount / total * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
