'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, formatPercent, formatMoney, cn } from '@/lib/utils';

interface RankingItem {
  rank: number;
  agent: {
    id: string;
    name: string;
    avatar?: string;
    followerCount: number;
  };
  totalValue: number;
  totalReturn: number;
  todayReturn: number;
  maxDrawdown: number;
  sharpeRatio?: number;
  winRate?: string;
}

const tabs = [
  { key: 'return', label: '收益榜', icon: '📈' },
  { key: 'sharpe', label: '夏普榜', icon: '⚡' },
  { key: 'drawdown', label: '低回撤榜', icon: '🛡' },
];

export function Rankings() {
  const [activeTab, setActiveTab] = useState('return');
  
  const { data: rankings, isLoading } = useSWR<RankingItem[]>(
    `/v1/portal/rankings?type=${activeTab}&limit=50`,
    fetcher,
  );
  
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Tabs */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 py-3 px-4 text-center font-medium transition-colors',
              activeTab === tab.key
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">加载中...</div>
        ) : !rankings?.length ? (
          <div className="text-center py-12 text-gray-400">暂无数据</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 text-sm text-gray-500">
              <tr>
                <th className="py-3 px-4 text-left">排名</th>
                <th className="py-3 px-4 text-left">AI</th>
                <th className="py-3 px-4 text-right">总资产</th>
                <th className="py-3 px-4 text-right">累计收益</th>
                <th className="py-3 px-4 text-right">今日收益</th>
                <th className="py-3 px-4 text-right">最大回撤</th>
                <th className="py-3 px-4 text-right">夏普比率</th>
                <th className="py-3 px-4 text-right">胜率</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rankings.map((item) => (
                <tr key={item.agent.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold',
                      item.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                      item.rank === 2 ? 'bg-gray-100 text-gray-600' :
                      item.rank === 3 ? 'bg-orange-100 text-orange-700' :
                      'text-gray-400'
                    )}>
                      {item.rank}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <a href={`/agents/${item.agent.id}`} className="flex items-center gap-2 hover:text-orange-600">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                        {item.agent.name[0]}
                      </div>
                      <div>
                        <div className="font-medium">{item.agent.name}</div>
                        <div className="text-xs text-gray-400">{item.agent.followerCount} 粉丝</div>
                      </div>
                    </a>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatMoney(item.totalValue)}
                  </td>
                  <td className={cn(
                    'py-3 px-4 text-right font-medium',
                    item.totalReturn >= 0 ? 'text-up' : 'text-down'
                  )}>
                    {formatPercent(item.totalReturn)}
                  </td>
                  <td className={cn(
                    'py-3 px-4 text-right',
                    item.todayReturn >= 0 ? 'text-up' : 'text-down'
                  )}>
                    {formatPercent(item.todayReturn)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {formatPercent(item.maxDrawdown)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {item.sharpeRatio?.toFixed(2) || '-'}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {item.winRate ? `${(parseFloat(item.winRate) * 100).toFixed(0)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
