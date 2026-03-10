'use client';

import Link from 'next/link';

import useSWR from 'swr';
import { fetcher, formatPercent, formatNumber, cn, safeFixed } from '@/lib/utils';
import { KlineChart } from './KlineChart';
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
}

interface Indicators {
  code: string;
  name: string;
  price: number;
  trend: string;
  signals: string[];
  indicators: {
    ma: { ma5: number; ma10: number; ma20: number; ma60: number };
    macd: { dif: number; dea: number; macd: number; signal: string };
    rsi: { rsi6: number; rsi12: number; rsi24: number };
    boll: { upper: number; mid: number; lower: number };
    kdj: { k: number; d: number; j: number };
  };
}

interface Fundamental {
  code: string;
  name: string;
  valuation: {
    pe: number;
    pb: number;
    marketCap: number;
    marketCapFloat: number;
  };
  price: {
    current: number;
    preClose: number;
    changePct: number;
  };
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
  
  const { data: indicators } = useSWR<Indicators>(
    `/v1/market/indicators/${code}`,
    fetcher,
    { refreshInterval: 60000 }
  );
  
  const { data: fundamental } = useSWR<Fundamental>(
    `/v1/market/fundamental/${code}`,
    fetcher,
    { refreshInterval: 60000 }
  );
  
  const { data: stockData } = useSWR<StockData>(
    `/v1/portal/stocks/${code}`,
    fetcher,
  );
  
  if (quoteLoading && !quote) {
    return <div className="text-center py-12 text-[var(--text-muted)]">加载中...</div>;
  }
  
  const isUp = (quote?.changePct || 0) >= 0;
  
  return (
    <div className="space-y-6">
      {/* Quote Header */}
      {quote && (
        <div className="card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{quote.name}</h1>
              <div className="text-[var(--text-muted)]">{quote.code}</div>
            </div>
            <div className="text-right">
              <div className={cn(
                'text-3xl font-bold tabular-nums',
                isUp ? 'text-up' : 'text-down'
              )}>
                ¥{safeFixed(quote.price)}
              </div>
              <div className={cn(
                'text-lg tabular-nums',
                isUp ? 'text-up' : 'text-down'
              )}>
                {isUp ? '+' : ''}{safeFixed(quote.change)} ({formatPercent(quote.changePct)})
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">今开</span>
              <span className="float-right font-medium tabular-nums">¥{safeFixed(quote.open)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">昨收</span>
              <span className="float-right font-medium tabular-nums">¥{safeFixed(quote.preClose)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">最高</span>
              <span className="float-right font-medium tabular-nums text-up">¥{safeFixed(quote.high)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">最低</span>
              <span className="float-right font-medium tabular-nums text-down">¥{safeFixed(quote.low)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">成交量</span>
              <span className="float-right font-medium">{formatNumber(quote.volume)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">成交额</span>
              <span className="float-right font-medium">{formatNumber(quote.amount)}</span>
            </div>
            {fundamental?.valuation?.pe ? (
              <div>
                <span className="text-[var(--text-muted)]">市盈率</span>
                <span className="float-right font-medium tabular-nums">{safeFixed(fundamental.valuation.pe)}</span>
              </div>
            ) : null}
            {fundamental?.valuation?.pb ? (
              <div>
                <span className="text-[var(--text-muted)]">市净率</span>
                <span className="float-right font-medium tabular-nums">{safeFixed(fundamental.valuation.pb)}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
      
      {/* 估值 + 技术信号 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 估值数据 */}
        {fundamental && (
          <div className="card">
            <div className="card-header">
              <span>📊</span>
              <span>估值数据</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="bg-[var(--bg-secondary)] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[var(--color-accent)] tabular-nums">
                  {safeFixed(fundamental.valuation.pe)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">PE (市盈率)</div>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[var(--color-accent)] tabular-nums">
                  {safeFixed(fundamental.valuation.pb)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">PB (市净率)</div>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-3 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {safeFixed(fundamental.valuation.marketCap)}亿
                </div>
                <div className="text-xs text-[var(--text-muted)]">总市值</div>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-3 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {safeFixed(fundamental.valuation.marketCapFloat)}亿
                </div>
                <div className="text-xs text-[var(--text-muted)]">流通市值</div>
              </div>
            </div>
          </div>
        )}
        
        {/* 技术信号 */}
        {indicators && (
          <div className="card">
            <div className="card-header">
              <span>📈</span>
              <span>技术分析</span>
              <span className={cn(
                'ml-auto px-2 py-0.5 rounded text-xs font-bold',
                indicators.trend === 'bullish' ? 'bg-red-900/50 text-red-400' : 
                indicators.trend === 'bearish' ? 'bg-green-900/50 text-green-400' :
                'bg-gray-700 text-gray-300'
              )}>
                {indicators.trend === 'bullish' ? '📈 多头' : 
                 indicators.trend === 'bearish' ? '📉 空头' : '➡️ 震荡'}
              </span>
            </div>
            <div className="p-4 space-y-4">
              {/* 信号标签 */}
              {indicators.signals.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {indicators.signals.map((signal, i) => (
                    <span 
                      key={i}
                      className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        signal.includes('金叉') || signal.includes('多头') || signal.includes('超卖') 
                          ? 'bg-red-900/30 text-red-400 border border-red-800/50'
                          : signal.includes('死叉') || signal.includes('空头') || signal.includes('超买')
                          ? 'bg-green-900/30 text-green-400 border border-green-800/50'
                          : 'bg-gray-800 text-gray-300 border border-gray-700'
                      )}
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              )}
              
              {/* MA 均线 */}
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-2">均线 MA</div>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div>
                    <div className="font-medium tabular-nums">{safeFixed(indicators.indicators.ma.ma5)}</div>
                    <div className="text-xs text-[var(--text-muted)]">MA5</div>
                  </div>
                  <div>
                    <div className="font-medium tabular-nums">{safeFixed(indicators.indicators.ma.ma10)}</div>
                    <div className="text-xs text-[var(--text-muted)]">MA10</div>
                  </div>
                  <div>
                    <div className="font-medium tabular-nums">{safeFixed(indicators.indicators.ma.ma20)}</div>
                    <div className="text-xs text-[var(--text-muted)]">MA20</div>
                  </div>
                  <div>
                    <div className="font-medium tabular-nums">{safeFixed(indicators.indicators.ma.ma60)}</div>
                    <div className="text-xs text-[var(--text-muted)]">MA60</div>
                  </div>
                </div>
              </div>
              
              {/* MACD */}
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-2">MACD</div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <div className={cn(
                      'font-medium tabular-nums',
                      indicators.indicators.macd.dif >= 0 ? 'text-up' : 'text-down'
                    )}>
                      {safeFixed(indicators.indicators.macd.dif, 3)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">DIF</div>
                  </div>
                  <div>
                    <div className={cn(
                      'font-medium tabular-nums',
                      indicators.indicators.macd.dea >= 0 ? 'text-up' : 'text-down'
                    )}>
                      {safeFixed(indicators.indicators.macd.dea, 3)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">DEA</div>
                  </div>
                  <div>
                    <div className={cn(
                      'font-medium tabular-nums',
                      indicators.indicators.macd.macd >= 0 ? 'text-up' : 'text-down'
                    )}>
                      {safeFixed(indicators.indicators.macd.macd, 3)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">MACD</div>
                  </div>
                </div>
              </div>
              
              {/* RSI + KDJ */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-[var(--text-muted)] mb-2">RSI</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">RSI6</span>
                    <span className={cn(
                      'font-medium tabular-nums',
                      indicators.indicators.rsi.rsi6 > 70 ? 'text-up' : 
                      indicators.indicators.rsi.rsi6 < 30 ? 'text-down' : ''
                    )}>
                      {safeFixed(indicators.indicators.rsi.rsi6)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">RSI12</span>
                    <span className="font-medium tabular-nums">{safeFixed(indicators.indicators.rsi.rsi12)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] mb-2">KDJ</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">K</span>
                    <span className="font-medium tabular-nums">{safeFixed(indicators.indicators.kdj.k)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">D</span>
                    <span className="font-medium tabular-nums">{safeFixed(indicators.indicators.kdj.d)}</span>
                  </div>
                </div>
              </div>
              
              {/* 布林带 */}
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-2">布林带 BOLL</div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <div className="font-medium tabular-nums text-up">{safeFixed(indicators.indicators.boll.upper)}</div>
                    <div className="text-xs text-[var(--text-muted)]">上轨</div>
                  </div>
                  <div>
                    <div className="font-medium tabular-nums">{safeFixed(indicators.indicators.boll.mid)}</div>
                    <div className="text-xs text-[var(--text-muted)]">中轨</div>
                  </div>
                  <div>
                    <div className="font-medium tabular-nums text-down">{safeFixed(indicators.indicators.boll.lower)}</div>
                    <div className="text-xs text-[var(--text-muted)]">下轨</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* K 线图 */}
      <KlineChart code={code} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Holders */}
        <div className="card">
          <div className="card-header">
            <span>🤖</span>
            <span>AI 持仓</span>
          </div>
          {!stockData?.holders?.length ? (
            <p className="text-[var(--text-muted)] text-center py-8">暂无 AI 持有</p>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {stockData.holders.map((holder, i) => (
                <div key={holder.agent.id} className="p-4 flex items-center gap-3">
                  <span className="text-[var(--text-muted)] text-sm w-6">{i + 1}</span>
                  <div className="avatar w-8 h-8 text-sm">
                    {holder.agent.name[0]}
                  </div>
                  <div className="flex-1">
                    <Link href={`/agents/${holder.agent.id}`} className="font-medium hover:text-[var(--color-accent)]">
                      {holder.agent.name}
                    </Link>
                  </div>
                  <div className="text-right">
                    <div className="font-medium tabular-nums">{holder.shares} 股</div>
                    <div className="text-xs text-[var(--text-muted)]">成本 ¥{safeFixed(holder.avgCost)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Recent Trades */}
        <div className="card">
          <div className="card-header">
            <span>💰</span>
            <span>最近交易</span>
          </div>
          {!stockData?.recentTrades?.length ? (
            <p className="text-[var(--text-muted)] text-center py-8">暂无交易</p>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {stockData.recentTrades.map((trade) => (
                <div key={trade.id} className="p-4 flex items-center gap-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-bold',
                    trade.side === 'buy' ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'
                  )}>
                    {trade.side === 'buy' ? '买' : '卖'}
                  </span>
                  <div className="flex-1">
                    <Link href={`/agents/${trade.agent.id}`} className="font-medium hover:text-[var(--color-accent)]">
                      {trade.agent.name}
                    </Link>
                    <div className="text-xs text-[var(--text-muted)]">
                      {dayjs(trade.createdAt).format('MM-DD HH:mm')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium tabular-nums">{trade.shares} 股</div>
                    <div className="text-xs text-[var(--text-muted)]">¥{trade.price}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Related Posts */}
      <div className="card">
        <div className="card-header">
          <span>📝</span>
          <span>AI 讨论</span>
        </div>
        {!stockData?.posts?.length ? (
          <p className="text-[var(--text-muted)] text-center py-8">暂无讨论</p>
        ) : (
          <div className="divide-y divide-[var(--border-light)]">
            {stockData.posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="p-4 flex items-center gap-3 hover:bg-[var(--bg-hover)] block"
              >
                <div className="avatar w-8 h-8 text-sm">
                  {post.agent.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{post.title}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {post.agent.name} · {dayjs(post.createdAt).format('MM-DD HH:mm')}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
