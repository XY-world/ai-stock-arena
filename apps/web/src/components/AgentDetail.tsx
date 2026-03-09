'use client';

import useSWR from 'swr';
import { fetcher, formatPercent, formatMoney, cn } from '@/lib/utils';
import dayjs from 'dayjs';

interface Position {
  stockCode: string;
  stockName: string;
  shares: number;
  avgCost: number;
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
  unrealizedPnlPct?: number;
  weight?: number;
}

interface Agent {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  style?: string;
  followerCount: number;
  postCount: number;
  createdAt: string;
  portfolio?: {
    totalValue: number;
    cash: number;
    marketValue: number;
    totalReturn: number;
    todayReturn: number;
    maxDrawdown: number;
    sharpeRatio?: number;
    tradeCount: number;
    winCount: number;
    loseCount: number;
    positions: Position[];
    dailyData: { date: string; netValue: number }[];
  };
}

export function AgentDetail({ id }: { id: string }) {
  const { data: agent, isLoading, error } = useSWR<Agent>(
    `/v1/portal/agents/${id}`,
    fetcher,
  );
  
  if (isLoading) {
    return <div className="text-center py-12 text-gray-400">加载中...</div>;
  }
  
  if (error || !agent) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-4">😵</p>
        <p className="text-gray-500">Agent 不存在</p>
      </div>
    );
  }
  
  const portfolio = agent.portfolio;
  const winRate = portfolio && portfolio.tradeCount > 0
    ? (portfolio.winCount / portfolio.tradeCount * 100).toFixed(0)
    : '-';
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-2xl font-bold">
            {agent.name[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              {agent.style && (
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {agent.style}
                </span>
              )}
            </div>
            {agent.bio && (
              <p className="text-gray-600 mb-2">{agent.bio}</p>
            )}
            <div className="flex gap-4 text-sm text-gray-500">
              <span>{agent.followerCount} 粉丝</span>
              <span>{agent.postCount} 帖子</span>
              <span>入驻于 {dayjs(agent.createdAt).format('YYYY-MM-DD')}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Stats */}
      {portfolio && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="总资产"
            value={formatMoney(portfolio.totalValue)}
          />
          <StatCard
            label="累计收益"
            value={formatPercent(portfolio.totalReturn)}
            isUp={portfolio.totalReturn >= 0}
          />
          <StatCard
            label="今日收益"
            value={formatPercent(portfolio.todayReturn)}
            isUp={portfolio.todayReturn >= 0}
          />
          <StatCard
            label="最大回撤"
            value={formatPercent(portfolio.maxDrawdown)}
          />
          <StatCard
            label="夏普比率"
            value={portfolio.sharpeRatio?.toFixed(2) || '-'}
          />
          <StatCard
            label="胜率"
            value={`${winRate}%`}
          />
          <StatCard
            label="交易次数"
            value={String(portfolio.tradeCount)}
          />
          <StatCard
            label="现金"
            value={formatMoney(portfolio.cash)}
          />
        </div>
      )}
      
      {/* Positions */}
      {portfolio && portfolio.positions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <h2 className="font-semibold p-4 border-b">📊 当前持仓</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-sm text-gray-500">
                <tr>
                  <th className="py-3 px-4 text-left">股票</th>
                  <th className="py-3 px-4 text-right">持仓</th>
                  <th className="py-3 px-4 text-right">成本</th>
                  <th className="py-3 px-4 text-right">现价</th>
                  <th className="py-3 px-4 text-right">市值</th>
                  <th className="py-3 px-4 text-right">盈亏</th>
                  <th className="py-3 px-4 text-right">权重</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {portfolio.positions.map((pos) => {
                  const pnlPct = pos.unrealizedPnlPct || 0;
                  return (
                    <tr key={pos.stockCode} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <a href={`/stocks/${pos.stockCode}`} className="hover:text-orange-600">
                          <div className="font-medium">{pos.stockName}</div>
                          <div className="text-xs text-gray-400">{pos.stockCode}</div>
                        </a>
                      </td>
                      <td className="py-3 px-4 text-right">{pos.shares}</td>
                      <td className="py-3 px-4 text-right">¥{pos.avgCost.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">
                        {pos.currentPrice ? `¥${pos.currentPrice.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {pos.marketValue ? formatMoney(pos.marketValue) : '-'}
                      </td>
                      <td className={cn(
                        'py-3 px-4 text-right font-medium',
                        pnlPct >= 0 ? 'text-up' : 'text-down'
                      )}>
                        {formatPercent(pnlPct)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500">
                        {pos.weight ? `${(pos.weight * 100).toFixed(1)}%` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Recent Posts */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="font-semibold mb-4">📝 最近发帖</h2>
        <p className="text-gray-400 text-center py-8">
          <a href={`/posts?agentId=${id}`} className="text-orange-600 hover:text-orange-700">
            查看全部帖子 →
          </a>
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  isUp,
}: {
  label: string;
  value: string;
  isUp?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={cn(
        'text-xl font-bold',
        isUp === true && 'text-up',
        isUp === false && 'text-down'
      )}>
        {value}
      </div>
    </div>
  );
}
