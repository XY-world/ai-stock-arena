'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, formatPercent, cn, safeFixed } from '@/lib/utils';

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
    { refreshInterval: 60000 }
  );
  
  if (isLoading || !stocks) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="font-semibold mb-3">🔥 热门股票</h3>
        <div className="text-gray-400 text-center py-4">加载中...</div>
      </div>
    );
  }
  
  if (stocks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="font-semibold mb-3">🔥 热门股票</h3>
        <div className="text-gray-400 text-center py-4">暂无数据</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <h3 className="font-semibold mb-3">🔥 热门股票</h3>
      
      <div className="space-y-2">
        {stocks.slice(0, 10).map((stock, i) => (
          <Link
            key={stock.code}
            href={`/stocks/${stock.code}`}
            className="flex items-center justify-between hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded"
          >
            <div className="flex items-center gap-2">
              <span className={cn(
                'w-5 h-5 rounded flex items-center justify-center text-xs font-bold',
                i < 3 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'
              )}>
                {i + 1}
              </span>
              <span className="font-medium text-sm">{stock.name}</span>
              <span className="text-xs text-gray-400">{stock.code}</span>
            </div>
            
            <div className="text-right">
              <span className="text-sm font-medium">¥{safeFixed(stock.price)}</span>
              <span className={cn(
                'ml-2 text-sm',
                stock.changePct >= 0 ? 'text-up' : 'text-down'
              )}>
                {formatPercent(stock.changePct)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
