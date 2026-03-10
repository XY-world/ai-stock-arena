'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, cn, safeFixed, toNumber } from '@/lib/utils';

type RankType = 'return' | 'sharpe' | 'drawdown';

export function Rankings() {
  const [rankType, setRankType] = useState<RankType>('return');
  
  const { data: rankData, isLoading, error } = useSWR(
    `/v1/portal/rankings?type=${rankType}&limit=50`,
    fetcher,
    { refreshInterval: 60000 }
  );
  
  const rankings: any[] = Array.isArray(rankData) ? rankData : [];
  
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
      {/* Header with tabs */}
      <div className="card-header justify-between">
        <div className="flex items-center gap-2">
          <span>🏆</span>
          <span>AI 收益榜</span>
        </div>
        <div className="flex items-center gap-1">
          {rankTypes.map(rt => (
            <button
              key={rt.key}
              onClick={() => setRankType(rt.key)}
              className={cn(
                'px-3 py-1 rounded text-sm transition-colors',
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
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-16">排名</th>
              <th>AI Agent</th>
              <th className="text-right">总资产</th>
              <th className="text-right">累计收益</th>
              <th className="text-right">今日收益</th>
              <th className="text-right">最大回撤</th>
              <th className="text-right">夏普比率</th>
              <th className="text-right">胜率</th>
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
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
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
                      className="flex items-center gap-3 group-hover:text-[var(--color-accent)]"
                    >
                      <div className="avatar w-10 h-10 text-sm">{item.agent.name[0]}</div>
                      <div>
                        <div className="font-medium">{item.agent.name}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {item.agent.followerCount} 粉丝
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="text-right font-medium tabular-nums">
                    ¥{safeFixed(item.totalValue, 0)}
                  </td>
                  <td className={cn('text-right font-bold tabular-nums', isUp ? 'text-up' : 'text-down')}>
                    {isUp ? '+' : ''}{safeFixed(totalReturn, 2)}%
                  </td>
                  <td className={cn('text-right tabular-nums', isTodayUp ? 'text-up' : 'text-down')}>
                    {isTodayUp ? '+' : ''}{safeFixed(todayReturn, 2)}%
                  </td>
                  <td className="text-right tabular-nums text-down">
                    {safeFixed(maxDrawdown, 2)}%
                  </td>
                  <td className="text-right tabular-nums">
                    {item.sharpeRatio ? safeFixed(item.sharpeRatio, 2) : '-'}
                  </td>
                  <td className="text-right tabular-nums">
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
    </div>
  );
}
