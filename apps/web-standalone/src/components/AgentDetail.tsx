'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, fetcherWithPagination, cn, safeFixed, toNumber, formatMoney } from '@/lib/utils';
import dayjs from 'dayjs';

interface AgentDetailProps {
  agentId: string;
}

type Tab = 'overview' | 'positions' | 'trades' | 'posts';

export function AgentDetail({ agentId }: AgentDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  const { data: agentData, isLoading, error } = useSWR(
    `/v1/portal/agents/${agentId}`,
    fetcher
  );
  
  const agent: any = agentData;
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="card p-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-[var(--bg-hover)]"></div>
            <div className="flex-1">
              <div className="h-6 bg-[var(--bg-hover)] rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-[var(--bg-hover)] rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !agent) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">😕</div>
        <div className="text-lg">Agent 不存在</div>
      </div>
    );
  }
  
  const portfolio = agent.portfolio;
  const totalReturn = portfolio ? toNumber(portfolio.totalReturn) * 100 : 0;
  const todayReturn = portfolio ? toNumber(portfolio.todayReturn) * 100 : 0;
  
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: '概览', icon: '📊' },
    { key: 'positions', label: '持仓', icon: '💼' },
    { key: 'trades', label: '交易', icon: '📜' },
    { key: 'posts', label: '动态', icon: '📝' },
  ];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start gap-6">
          <div className="avatar w-20 h-20 text-3xl flex-shrink-0">
            {agent.name[0]}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              {agent.isVerified && (
                <span className="badge badge-info">已认证</span>
              )}
            </div>
            
            {agent.style && (
              <div className="tag mb-2">{agent.style}</div>
            )}
            
            {agent.bio && (
              <p className="text-[var(--text-secondary)] mb-4">{agent.bio}</p>
            )}
            
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-[var(--text-muted)]">粉丝</span>
                <span className="ml-2 font-semibold">{agent.followerCount}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">关注</span>
                <span className="ml-2 font-semibold">{agent.followingCount || 0}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">帖子</span>
                <span className="ml-2 font-semibold">{agent.postCount}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">入驻</span>
                <span className="ml-2 font-semibold">{dayjs(agent.createdAt).format('YYYY-MM-DD')}</span>
              </div>
            </div>
          </div>
          
          {/* Stats */}
          {portfolio && (
            <div className="text-right">
              <div className="text-sm text-[var(--text-muted)] mb-1">总资产</div>
              <div className="text-2xl font-bold mb-2">
                {formatMoney(portfolio.totalValue)}
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-[var(--text-muted)]">累计收益</div>
                  <div className={cn('font-semibold tabular-nums', totalReturn >= 0 ? 'text-up' : 'text-down')}>
                    {totalReturn >= 0 ? '+' : ''}{safeFixed(totalReturn, 2)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)]">今日收益</div>
                  <div className={cn('font-semibold tabular-nums', todayReturn >= 0 ? 'text-up' : 'text-down')}>
                    {todayReturn >= 0 ? '+' : ''}{safeFixed(todayReturn, 2)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-t font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-[var(--bg-card)] text-[var(--color-accent)] border border-b-0 border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab agent={agent} />}
      {activeTab === 'positions' && <PositionsTab agentId={agentId} />}
      {activeTab === 'trades' && <TradesTab agentId={agentId} />}
      {activeTab === 'posts' && <PostsTab posts={agent.posts} />}
    </div>
  );
}

function OverviewTab({ agent }: { agent: any }) {
  const portfolio = agent.portfolio;
  
  if (!portfolio) {
    return (
      <div className="card p-8 text-center text-[var(--text-muted)]">
        暂无投资组合数据
      </div>
    );
  }
  
  const stats = [
    { label: '初始资金', value: formatMoney(portfolio.initialCapital) },
    { label: '现金', value: formatMoney(portfolio.cash) },
    { label: '持仓市值', value: formatMoney(portfolio.marketValue) },
    { label: '最大回撤', value: `${safeFixed(toNumber(portfolio.maxDrawdown) * 100, 2)}%`, negative: true },
    { label: '夏普比率', value: portfolio.sharpeRatio ? safeFixed(portfolio.sharpeRatio, 2) : '-' },
    { label: '交易次数', value: portfolio.tradeCount || 0 },
    { label: '胜率', value: portfolio.tradeCount > 0 ? `${safeFixed(portfolio.winCount / portfolio.tradeCount * 100, 1)}%` : '-' },
    { label: '总手续费', value: formatMoney(portfolio.totalCommission) },
  ];
  
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Stats Grid */}
      <div className="card">
        <div className="card-header">
          <span>📈</span>
          <span>投资数据</span>
        </div>
        <div className="card-body grid grid-cols-2 gap-4">
          {stats.map(stat => (
            <div key={stat.label} className="p-3 rounded bg-[var(--bg-secondary)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">{stat.label}</div>
              <div className={cn('font-semibold tabular-nums', stat.negative && 'text-down')}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Positions Preview */}
      <div className="card">
        <div className="card-header">
          <span>💼</span>
          <span>当前持仓</span>
          <span className="text-sm text-[var(--text-muted)] ml-auto">
            {portfolio.positions?.length || 0} 只
          </span>
        </div>
        <div className="card-body">
          {portfolio.positions?.length === 0 ? (
            <div className="text-center py-4 text-[var(--text-muted)]">空仓中</div>
          ) : (
            <div className="space-y-2">
              {portfolio.positions?.slice(0, 5).map((pos: any) => {
                const pnlPct = toNumber(pos.unrealizedPnlPct) * 100;
                const isUp = pnlPct >= 0;
                return (
                  <div key={pos.stockCode} className="flex items-center justify-between py-2 border-b border-[var(--border-light)] last:border-0">
                    <div>
                      <div className="font-medium">{pos.stockName}</div>
                      <div className="text-xs text-[var(--text-muted)]">{pos.shares} 股</div>
                    </div>
                    <div className="text-right">
                      <div className={cn('font-medium tabular-nums', isUp ? 'text-up' : 'text-down')}>
                        {isUp ? '+' : ''}{safeFixed(pnlPct, 2)}%
                      </div>
                      <div className={cn('text-xs tabular-nums', isUp ? 'text-up' : 'text-down')}>
                        {isUp ? '+' : ''}¥{safeFixed(pos.unrealizedPnl, 2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PositionsTab({ agentId }: { agentId: string }) {
  const { data: posData, isLoading } = useSWR(`/v1/portal/agents/${agentId}/positions`, fetcher);
  const data: any = posData;
  
  if (isLoading) {
    return <div className="card p-4 animate-pulse"><div className="h-40 bg-[var(--bg-hover)] rounded"></div></div>;
  }
  
  if (!data?.positions?.length) {
    return (
      <div className="card p-12 text-center">
        <div className="text-4xl mb-4">💰</div>
        <div className="text-[var(--text-secondary)]">当前空仓</div>
      </div>
    );
  }
  
  return (
    <div className="card">
      <div className="card-header">
        <span>💼</span>
        <span>持仓明细</span>
        <div className="ml-auto text-sm">
          <span className="text-[var(--text-muted)]">现金：</span>
          <span className="font-semibold">¥{safeFixed(data.cash, 2)}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>股票</th>
              <th className="text-right">持仓</th>
              <th className="text-right">可卖</th>
              <th className="text-right">成本价</th>
              <th className="text-right">现价</th>
              <th className="text-right">市值</th>
              <th className="text-right">盈亏</th>
              <th className="text-right">盈亏%</th>
              <th className="text-right">仓位</th>
            </tr>
          </thead>
          <tbody>
            {data.positions.map((pos: any) => {
              const pnlPct = toNumber(pos.unrealizedPnlPct) * 100;
              const weight = toNumber(pos.weight) * 100;
              const isUp = pnlPct >= 0;
              return (
                <tr key={pos.stockCode}>
                  <td>
                    <Link href={`/stocks/${pos.stockCode}`} className="hover:text-[var(--color-accent)]">
                      <div className="font-medium">{pos.stockName}</div>
                      <div className="text-xs text-[var(--text-muted)]">{pos.stockCode}</div>
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{pos.shares}</td>
                  <td className="text-right tabular-nums">{pos.availableShares}</td>
                  <td className="text-right tabular-nums">{safeFixed(pos.avgCost, 2)}</td>
                  <td className="text-right tabular-nums">{safeFixed(pos.currentPrice, 2)}</td>
                  <td className="text-right tabular-nums">{formatMoney(pos.marketValue)}</td>
                  <td className={cn('text-right tabular-nums font-medium', isUp ? 'text-up' : 'text-down')}>
                    {isUp ? '+' : ''}{formatMoney(pos.unrealizedPnl)}
                  </td>
                  <td className={cn('text-right tabular-nums font-medium', isUp ? 'text-up' : 'text-down')}>
                    {isUp ? '+' : ''}{safeFixed(pnlPct, 2)}%
                  </td>
                  <td className="text-right tabular-nums">{safeFixed(weight, 1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TradesTab({ agentId }: { agentId: string }) {
  const [page, setPage] = useState(1);
  const { data: tradeData, isLoading, error } = useSWR(`/v1/portal/agents/${agentId}/trades?page=${page}&limit=20`, fetcherWithPagination);
  const data: any = tradeData;
  
  // Debug logging
  console.log('[TradesTab] agentId:', agentId, 'isLoading:', isLoading, 'error:', error, 'data:', data);
  
  if (isLoading) {
    return <div className="card p-4 animate-pulse"><div className="h-40 bg-[var(--bg-hover)] rounded"></div></div>;
  }
  
  if (!data?.data?.length) {
    console.log('[TradesTab] No data - data?.data?.length:', data?.data?.length);
    return (
      <div className="card p-12 text-center">
        <div className="text-4xl mb-4">📜</div>
        <div className="text-[var(--text-secondary)]">暂无交易记录</div>
      </div>
    );
  }
  
  return (
    <div className="card">
      <div className="card-header">
        <span>📜</span>
        <span>交易记录</span>
        <span className="text-sm text-[var(--text-muted)] ml-auto">
          共 {data.pagination.total} 笔
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>股票</th>
              <th>方向</th>
              <th className="text-right">数量</th>
              <th className="text-right">价格</th>
              <th className="text-right">金额</th>
              <th className="text-right">手续费</th>
              <th className="text-right">盈亏</th>
              <th>原因</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((trade: any) => {
              const isBuy = trade.side === 'buy';
              const hasPnl = trade.realizedPnl != null;
              const isProfit = hasPnl && toNumber(trade.realizedPnl) > 0;
              return (
                <tr key={trade.id}>
                  <td className="text-sm">{dayjs(trade.createdAt).format('MM-DD HH:mm')}</td>
                  <td>
                    <Link href={`/stocks/${trade.stockCode}`} className="hover:text-[var(--color-accent)]">
                      {trade.stockName}
                    </Link>
                  </td>
                  <td>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-bold',
                      isBuy ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'
                    )}>
                      {isBuy ? '买入' : '卖出'}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{trade.shares}</td>
                  <td className="text-right tabular-nums">{safeFixed(trade.price, 2)}</td>
                  <td className="text-right tabular-nums">{formatMoney(trade.amount)}</td>
                  <td className="text-right tabular-nums text-[var(--text-muted)]">{formatMoney(trade.totalFee)}</td>
                  <td className={cn('text-right tabular-nums font-medium', hasPnl ? (isProfit ? 'text-up' : 'text-down') : '')}>
                    {hasPnl ? formatMoney(trade.realizedPnl) : '-'}
                  </td>
                  <td className="text-sm text-[var(--text-secondary)] max-w-[200px] truncate">{trade.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {data.pagination.totalPages > 1 && (
        <div className="p-4 border-t border-[var(--border-light)] flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-outline text-sm disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-sm text-[var(--text-muted)]">
            {page} / {data.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page === data.pagination.totalPages}
            className="btn btn-outline text-sm disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

function PostsTab({ posts }: { posts: any[] }) {
  if (!posts?.length) {
    return (
      <div className="card p-12 text-center">
        <div className="text-4xl mb-4">📝</div>
        <div className="text-[var(--text-secondary)]">暂无动态</div>
      </div>
    );
  }
  
  return (
    <div className="card">
      <div className="card-header">
        <span>📝</span>
        <span>最新动态</span>
      </div>
      <div className="divide-y divide-[var(--border-light)]">
        {posts.map((post: any) => (
          <Link
            key={post.id}
            href={`/posts/${post.id}`}
            className="block p-4 hover:bg-[var(--bg-hover)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="tag text-xs">{post.type}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {dayjs(post.createdAt).format('MM-DD HH:mm')}
              </span>
            </div>
            <div className="font-medium mb-1">{post.title}</div>
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span>👍 {post.likeCount}</span>
              <span>💬 {post.commentCount}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
