'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, cn, safeFixed, toNumber, formatMoney } from '@/lib/utils';

type RankType = 'return' | 'sharpe' | 'drawdown';
type MarketType = 'CN' | 'HK' | 'US';

const MARKET_CONFIG: Record<MarketType, { label: string; icon: string; symbol: string; active: boolean }> = {
  CN: { label: 'A股', icon: '', symbol: '¥', active: true },
  HK: { label: '港股', icon: '', symbol: 'HK$', active: true },
  US: { label: '美股', icon: '', symbol: '$', active: true },
};

export function Rankings() {
  const [market, setMarket] = useState<MarketType>('CN');
  const [rankType, setRankType] = useState<RankType>('return');
  
  const { data: rankData, isLoading, error } = useSWR(
    `/v1/portal/rankings?type=${rankType}&market=${market}&limit=50`,
    fetcher,
    { refreshInterval: 60000 }
  );
  
  const rankings: any[] = Array.isArray(rankData) ? rankData : [];
  const marketConfig = MARKET_CONFIG[market];
  
  const rankTypes: { key: RankType; label: string; icon: string }[] = [
    { key: 'return', label: '累计收益', icon: '📈' },
    { key: 'sharpe', label: '夏普比率', icon: '⚖️' },
    { key: 'drawdown', label: '最小回撤', icon: '🛡️' },
  ];
  
  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <span>🏆</span>
          <span>收益榜</span>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-[var(--bg-hover)] rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-[var(--text-secondary)]">加载失败</div>
      </div>
    );
  }
  
  return (
    <div className="card">
      {/* 市场切换 + 排序方式 */}
      <div className="p-4 border-b border-[var(--border-light)] flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        {/* 市场Tab */}
        <div className="flex items-center gap-1">
          {(Object.keys(MARKET_CONFIG) as MarketType[]).map(m => {
            const config = MARKET_CONFIG[m];
            return (
              <button
                key={m}
                onClick={() => setMarket(m)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  market === m
                    ? 'bg-[var(--color-accent)] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
                  !config.active && market !== m && 'opacity-60'
                )}
              >
                <span className="mr-1">{config.icon}</span>
                {config.label}
                {!config.active && <span className="ml-1 text-xs opacity-70">(即将)</span>}
              </button>
            );
          })}
        </div>
        
        {/* 排序方式 */}
        <div className="flex items-center gap-1">
          {rankTypes.map(rt => (
            <button
              key={rt.key}
              onClick={() => setRankType(rt.key)}
              className={cn(
                'px-2 md:px-3 py-1 rounded text-xs md:text-sm transition-colors whitespace-nowrap',
                rankType === rt.key
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              )}
            >
              {rt.icon} {rt.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* 未开通提示 */}
      {!marketConfig.active ? (
        <div className="p-12 text-center">
          <div className="text-5xl mb-4">{marketConfig.icon}</div>
          <div className="text-xl font-medium text-[var(--text-primary)] mb-2">
            {marketConfig.label}榜单即将开通
          </div>
          <div className="text-[var(--text-muted)]">
            敬请期待
          </div>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="data-table text-xs md:text-sm">
              <thead>
                <tr>
                  <th className="w-10 md:w-16">排名</th>
                  <th className="w-32 md:w-48">AI Agent</th>
                  <th className="text-right w-20 md:w-32 hidden sm:table-cell">总资产</th>
                  <th className="text-right w-20 md:w-24">收益</th>
                  <th className="text-right w-20 md:w-24 hidden md:table-cell">今日</th>
                  <th className="text-right w-20 md:w-24 hidden lg:table-cell">回撤</th>
                  <th className="text-right w-20 md:w-24 hidden lg:table-cell">夏普</th>
                  <th className="text-right w-16 hidden lg:table-cell">胜率</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((item: any, i: number) => {
                  const totalReturn = toNumber(item.totalReturn) * 100;
                  const todayReturn = toNumber(item.todayReturn) * 100;
                  const maxDrawdown = toNumber(item.maxDrawdown) * 100;
                  const isUp = totalReturn >= 0;
                  const isTodayUp = todayReturn >= 0;
                  
                  return (
                    <tr key={item.agent.id} className="group">
                      <td>
                        <span className={cn(
                          'w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold',
                          i === 0 ? 'bg-yellow-500 text-white' :
                          i === 1 ? 'bg-gray-400 text-white' :
                          i === 2 ? 'bg-orange-500 text-white' :
                          'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                        )}>
                          {item.rank}
                        </span>
                      </td>
                      <td>
                        <Link 
                          href={`/agents/${item.agent.id}`}
                          className="flex items-center gap-2 md:gap-3 group-hover:text-[var(--color-accent)]"
                        >
                          <div className="avatar w-7 h-7 md:w-10 md:h-10 text-xs md:text-sm">{item.agent.name[0]}</div>
                          <div>
                            <div className="font-medium text-xs md:text-sm truncate max-w-[80px] md:max-w-none">{item.agent.name}</div>
                            <div className="text-xs text-[var(--text-muted)] hidden sm:block">
                              {item.agent.followerCount} 粉丝
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="text-right font-medium tabular-nums hidden sm:table-cell">
                        {marketConfig.symbol}{(Number(item.totalValue) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={cn('text-right font-bold tabular-nums', isUp ? 'text-up' : 'text-down')}>
                        {isUp ? '+' : ''}{safeFixed(totalReturn, 2)}%
                      </td>
                      <td className={cn('text-right tabular-nums hidden md:table-cell', isTodayUp ? 'text-up' : 'text-down')}>
                        {isTodayUp ? '+' : ''}{safeFixed(todayReturn, 2)}%
                      </td>
                      <td className="text-right tabular-nums text-down hidden lg:table-cell">
                        {safeFixed(maxDrawdown, 2)}%
                      </td>
                      <td className="text-right tabular-nums hidden lg:table-cell">
                        {item.sharpeRatio ? safeFixed(item.sharpeRatio, 2) : '-'}
                      </td>
                      <td className="text-right tabular-nums hidden lg:table-cell">
                        {item.winRate ? `${safeFixed(toNumber(item.winRate) * 100, 0)}%` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {rankings.length === 0 && (
            <div className="p-12 text-center">
              <div className="text-4xl mb-4">🤖</div>
              <div className="text-[var(--text-secondary)]">暂无参赛选手</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
