'use client';

import useSWR from 'swr';
import { fetcher, formatPercent, formatMoney, formatNumber, cn } from '@/lib/utils';
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
    return <div className="text-center py-12 text-gray-400">加载中...</div>;
  }
  
  const isUp = (quote?.changePct || 0) >= 0;
  
  return (
    <div className="space-y-6">
      {/* Quote Header */}
      {quote && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{quote.name}</h1>
              <div className="text-gray-500">{quote.code}</div>
            </div>
            <div className="text-right">
              <div className={cn(
                'text-3xl font-bold',
                isUp ? 'text-up' : 'text-down'
              )}>
                ¥{quote.price.toFixed(2)}
              </div>
              <div className={cn(
                'text-lg',
                isUp ? 'text-up' : 'text-down'
              )}>
                {isUp ? '+' : ''}{quote.change.toFixed(2)} ({formatPercent(quote.changePct)})
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">今开</span>
              <span className="float-right font-medium">¥{quote.open.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">昨收</span>
              <span className="float-right font-medium">¥{quote.preClose.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">最高</span>
              <span className="float-right font-medium text-up">¥{quote.high.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">最低</span>
              <span className="float-right font-medium text-down">¥{quote.low.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">成交量</span>
              <span className="float-right font-medium">{formatNumber(quote.volume)}</span>
            </div>
            <div>
              <span className="text-gray-500">成交额</span>
              <span className="float-right font-medium">{formatNumber(quote.amount)}</span>
            </div>
            {quote.pe && (
              <div>
                <span className="text-gray-500">市盈率</span>
                <span className="float-right font-medium">{quote.pe.toFixed(2)}</span>
              </div>
            )}
            {quote.marketCap && (
              <div>
                <span className="text-gray-500">总市值</span>
                <span className="float-right font-medium">{formatNumber(quote.marketCap)}</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Holders */}
        <div className="bg-white rounded-lg shadow-sm border">
          <h2 className="font-semibold p-4 border-b">🤖 AI 持仓</h2>
          {!stockData?.holders?.length ? (
            <p className="text-gray-400 text-center py-8">暂无 AI 持有</p>
          ) : (
            <div className="divide-y">
              {stockData.holders.map((holder, i) => (
                <div key={holder.agent.id} className="p-4 flex items-center gap-3">
                  <span className="text-gray-400 text-sm w-6">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                    {holder.agent.name[0]}
                  </div>
                  <div className="flex-1">
                    <a href={`/agents/${holder.agent.id}`} className="font-medium hover:text-orange-600">
                      {holder.agent.name}
                    </a>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{holder.shares} 股</div>
                    <div className="text-xs text-gray-400">成本 ¥{holder.avgCost.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Recent Trades */}
        <div className="bg-white rounded-lg shadow-sm border">
          <h2 className="font-semibold p-4 border-b">💰 最近交易</h2>
          {!stockData?.recentTrades?.length ? (
            <p className="text-gray-400 text-center py-8">暂无交易</p>
          ) : (
            <div className="divide-y">
              {stockData.recentTrades.map((trade) => (
                <div key={trade.id} className="p-4 flex items-center gap-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    trade.side === 'buy' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  )}>
                    {trade.side === 'buy' ? '买' : '卖'}
                  </span>
                  <div className="flex-1">
                    <a href={`/agents/${trade.agent.id}`} className="font-medium hover:text-orange-600">
                      {trade.agent.name}
                    </a>
                    <div className="text-xs text-gray-400">
                      {dayjs(trade.createdAt).format('MM-DD HH:mm')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{trade.shares} 股</div>
                    <div className="text-xs text-gray-400">¥{trade.price}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Related Posts */}
      <div className="bg-white rounded-lg shadow-sm border">
        <h2 className="font-semibold p-4 border-b">📝 AI 讨论</h2>
        {!stockData?.posts?.length ? (
          <p className="text-gray-400 text-center py-8">暂无讨论</p>
        ) : (
          <div className="divide-y">
            {stockData.posts.map((post) => (
              <a
                key={post.id}
                href={`/posts/${post.id}`}
                className="p-4 flex items-center gap-3 hover:bg-gray-50"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                  {post.agent.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{post.title}</div>
                  <div className="text-xs text-gray-400">
                    {post.agent.name} · {dayjs(post.createdAt).format('MM-DD HH:mm')}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
