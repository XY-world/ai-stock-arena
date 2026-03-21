'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, fetcherWithPagination, cn, safeFixed, toNumber, formatMoney } from '@/lib/utils';
import dayjs from 'dayjs';

interface AgentDetailProps {
  agentId: string;
}

type Tab = 'accounts' | 'trades' | 'posts';
type Market = 'CN' | 'HK' | 'US';
type SubTab = 'overview' | 'positions';

// 市场配置
const MARKETS: { id: Market; label: string; flag: string }[] = [
  { id: 'CN', label: 'A股', flag: '' },
  { id: 'HK', label: '港股', flag: '' },
  { id: 'US', label: '美股', flag: '' },
];

export function AgentDetail({ agentId }: AgentDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('accounts');
  const [market, setMarket] = useState<Market>('CN');
  const [subTab, setSubTab] = useState<SubTab>('overview');
  
  const { data: agentData, isLoading, error } = useSWR(
    `/v1/portal/agents/${agentId}?market=${market}`,
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
  const portfolios = agent.portfolios || [];
  
  // 汇率和初始资金配置
  const EXCHANGE_RATES: Record<string, number> = {
    CN: 1,      // CNY
    HK: 0.92,   // HKD -> CNY
    US: 7.25,   // USD -> CNY
  };
  const INITIAL_CAPITAL: Record<string, number> = {
    CN: 1000000,
    HK: 1000000,
    US: 100000,
  };
  
  // 计算各市场收益率
  const getMarketReturn = (m: string) => {
    const p = portfolios.find((x: any) => x.market === m);
    return p ? toNumber(p.totalReturn) * 100 : 0;
  };
  
  // 计算总资产 (折合人民币)
  const totalAssetsCNY = ['CN', 'HK', 'US'].reduce((sum, m) => {
    const p = portfolios.find((x: any) => x.market === m);
    const value = toNumber(p?.totalValue) || INITIAL_CAPITAL[m];
    return sum + value * EXCHANGE_RATES[m];
  }, 0);
  
  // 当前市场的货币符号
  const MARKET_SYMBOL: Record<string, string> = {
    CN: '¥',
    HK: 'HK$',
    US: '$',
  };
  const symbol = MARKET_SYMBOL[market] || '¥';
  
  // 当前市场的总资产
  const currentTotalValue = portfolio ? toNumber(portfolio.totalValue) : (market === 'US' ? 100000 : 1000000);
  
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'accounts', label: '账户', icon: '💰' },
    { key: 'trades', label: '交易', icon: '📜' },
    { key: 'posts', label: '动态', icon: '📝' },
  ];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-4 sm:p-6">
        {/* Mobile: 垂直布局, Desktop: 水平布局 */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          {/* 头像和名称行 */}
          <div className="flex items-center gap-4 sm:block">
            <div className="avatar w-16 h-16 sm:w-20 sm:h-20 text-2xl sm:text-3xl flex-shrink-0">
              {agent.name[0]}
            </div>
            {/* Mobile: 名称在头像右边 */}
            <div className="sm:hidden">
              <h1 className="text-xl font-bold">{agent.name}</h1>
              {agent.style && (
                <div className="tag text-xs mt-1">{agent.style}</div>
              )}
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Desktop: 名称 */}
            <div className="hidden sm:flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              {agent.isVerified && (
                <span className="badge badge-info">已认证</span>
              )}
            </div>
            
            {agent.style && (
              <div className="tag mb-2 hidden sm:inline-block">{agent.style}</div>
            )}
            
            {agent.bio && (
              <p className="text-[var(--text-secondary)] text-sm sm:text-base mb-3 sm:mb-4 break-words">{agent.bio}</p>
            )}
            
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
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
          
          {/* Stats - 资产概览 */}
          <div className="mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-[var(--border-light)]">
            {/* 总资产 */}
            <div className="flex items-center justify-between sm:justify-end gap-4 mb-3">
              <div className="text-xs sm:text-sm text-[var(--text-muted)]">总资产</div>
              <div className="text-xl sm:text-2xl font-bold">
                ¥{totalAssetsCNY.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            {/* 各市场明细 */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 text-right">
              {(['CN', 'HK', 'US'] as const).map(m => {
                const p = portfolios.find((x: any) => x.market === m);
                const value = toNumber(p?.totalValue) || INITIAL_CAPITAL[m];
                const ret = p ? toNumber(p.totalReturn) * 100 : 0;
                const label = m === 'CN' ? 'A股' : m === 'HK' ? '港股' : '美股';
                const sym = MARKET_SYMBOL[m];
                return (
                  <div key={m} className="text-center sm:text-right">
                    <div className="text-xs text-[var(--text-muted)]">{label}</div>
                    <div className="text-sm font-medium">{sym}{(value / 10000).toFixed(2)}万</div>
                    <div className={cn('text-xs tabular-nums', ret >= 0 ? 'text-up' : 'text-down')}>
                      {ret >= 0 ? '+' : ''}{safeFixed(ret, 2)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* 一级 Tabs: 账户/交易/动态 */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-[var(--border-color)] pb-2 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 sm:px-4 py-2 rounded-t font-medium transition-colors whitespace-nowrap text-sm sm:text-base',
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
      {activeTab === 'accounts' && (
        <AccountsTabWithMarket 
          agentId={agentId} 
          agent={agent}
          market={market} 
          setMarket={setMarket}
          subTab={subTab}
          setSubTab={setSubTab}
        />
      )}
      {activeTab === 'trades' && <TradesTab agentId={agentId} />}
      {activeTab === 'posts' && <PostsTab posts={agent.posts} />}
    </div>
  );
}

// 市场货币符号
const MARKET_SYMBOL: Record<string, string> = {
  CN: '¥',
  HK: 'HK$',
  US: '$',
};

// 初始资金配置
const INITIAL_CAPITAL: Record<string, number> = {
  CN: 1000000,
  HK: 1000000,
  US: 100000,
};

function OverviewTab({ agent, market }: { agent: any; market: string }) {
  const portfolio = agent.portfolio;
  const symbol = MARKET_SYMBOL[market] || '¥';
  const initialCapital = INITIAL_CAPITAL[market] || 1000000;
  
  const formatMarketMoney = (value: number | string | undefined) => {
    const num = toNumber(value) || 0;
    return `${symbol}${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  if (!portfolio) {
    return (
      <div className="card p-8 text-center text-[var(--text-muted)]">
        暂无{market === 'CN' ? 'A股' : market === 'HK' ? '港股' : '美股'}投资组合数据
      </div>
    );
  }
  
  const stats = [
    { label: '初始资金', value: formatMarketMoney(portfolio.initialCapital || initialCapital) },
    { label: '现金', value: formatMarketMoney(portfolio.cash) },
    { label: '持仓市值', value: formatMarketMoney(portfolio.marketValue) },
    { label: '最大回撤', value: `${safeFixed(toNumber(portfolio.maxDrawdown) * 100, 2)}%`, negative: true },
    { label: '夏普比率', value: portfolio.sharpeRatio ? safeFixed(portfolio.sharpeRatio, 2) : '-' },
    { label: '交易次数', value: portfolio.tradeCount || 0 },
    { label: '胜率', value: portfolio.tradeCount > 0 ? `${safeFixed(portfolio.winCount / portfolio.tradeCount * 100, 1)}%` : '-' },
    { label: '总手续费', value: formatMarketMoney(portfolio.totalCommission) },
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

// 市场配置
const MARKET_CONFIG: Record<string, { name: string; flag: string; symbol: string; color: string; rules: string; hours: string }> = {
  CN: { name: 'A股', flag: '', symbol: '¥', color: 'text-red-400', rules: 'T+1 · 10%涨跌停', hours: '9:30-11:30, 13:00-15:00' },
  HK: { name: '港股', flag: '', symbol: 'HK$', color: 'text-blue-400', rules: 'T+0 · 无涨跌停', hours: '9:30-12:00, 13:00-16:00' },
  US: { name: '美股', flag: '', symbol: '$', color: 'text-green-400', rules: 'T+0 · 无涨跌停', hours: '21:30-04:00 (北京时间)' },
};

// 账户 Tab - 包含市场切换器和概览/持仓子视图
function AccountsTabWithMarket({ 
  agentId, 
  agent,
  market, 
  setMarket,
  subTab,
  setSubTab,
}: { 
  agentId: string; 
  agent: any;
  market: string; 
  setMarket: (m: any) => void;
  subTab: string;
  setSubTab: (t: any) => void;
}) {
  return (
    <div className="space-y-4">
      {/* 市场切换器 + 子 Tab */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* 市场切换器 */}
        <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-lg p-1">
          {MARKETS.map(m => (
            <button
              key={m.id}
              onClick={() => setMarket(m.id)}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                market === m.id
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {m.flag} {m.label}
            </button>
          ))}
        </div>
        
        {/* 概览/持仓 子 Tab */}
        <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-lg p-1">
          <button
            onClick={() => setSubTab('overview')}
            className={cn(
              'px-3 py-1.5 rounded text-sm font-medium transition-colors',
              subTab === 'overview'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            📊 概览
          </button>
          <button
            onClick={() => setSubTab('positions')}
            className={cn(
              'px-3 py-1.5 rounded text-sm font-medium transition-colors',
              subTab === 'positions'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            💼 持仓
          </button>
        </div>
      </div>
      
      {/* 内容 */}
      {subTab === 'overview' && <OverviewTab agent={agent} market={market} />}
      {subTab === 'positions' && <PositionsTab agentId={agentId} market={market} />}
    </div>
  );
}

function AccountsTab({ agentId, market: selectedMarket }: { agentId: string; market: string }) {
  // 获取 Agent 完整数据（包含 portfolios）
  const { data: agentData, isLoading } = useSWR(`/v1/portal/agents/${agentId}?market=${selectedMarket}`, fetcher);
  const agent: any = agentData;
  const portfoliosSummary = agent?.portfolios || []; // 各市场概览
  const currentPortfolio = agent?.portfolio; // 当前市场的详细数据（实时计算后）
  
  // 初始资金配置: A股100万CNY, 港股100万HKD, 美股10万USD
  const INITIAL_CAPITAL: Record<string, number> = {
    CN: 1000000,
    HK: 1000000,
    US: 100000,
  };
  
  // 汇率 (用于折算总资产)
  const EXCHANGE_RATES: Record<string, number> = {
    CN: 1,      // CNY
    HK: 0.92,   // HKD -> CNY
    US: 7.25,   // USD -> CNY
  };
  
  // 构建账户列表
  const accounts = ['CN', 'HK', 'US'].map(market => {
    const p = portfoliosSummary.find((x: any) => x.market === market);
    const initialCapital = INITIAL_CAPITAL[market];
    
    // 如果是当前市场，用实时计算的 portfolio 数据
    const isCurrentMarket = currentPortfolio?.market === market;
    const total = isCurrentMarket 
      ? toNumber(currentPortfolio?.totalValue) || initialCapital
      : toNumber(p?.totalValue) || initialCapital;
    const balance = isCurrentMarket
      ? toNumber(currentPortfolio?.cash) || initialCapital
      : toNumber(p?.cash) || initialCapital;
    const marketValue = isCurrentMarket
      ? toNumber(currentPortfolio?.marketValue) || 0
      : 0;
    
    return {
      market,
      balance,
      marketValue,
      total,
      positions: isCurrentMarket ? (currentPortfolio?.positions || []) : [],
      isActive: true,
      initialCapital,
    };
  });
  
  // 总资产 (折合CNY) - 使用汇率换算
  const totalAssetsCNY = accounts.reduce((sum, acc) => {
    return sum + acc.total * EXCHANGE_RATES[acc.market];
  }, 0);
  
  const formatCurrency = (value: number, market: string) => {
    const config = MARKET_CONFIG[market];
    // 确保数字格式正确，最多2位小数
    const num = Number(value) || 0;
    return `${config?.symbol || '¥'}${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  if (isLoading) {
    return <div className="card p-4 animate-pulse"><div className="h-40 bg-[var(--bg-hover)] rounded"></div></div>;
  }
  
  return (
    <div className="space-y-6">
      {/* 总资产汇总 */}
      <div className="card bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--bg-secondary)]">
        <div className="p-6">
          <div className="text-sm text-[var(--text-muted)] mb-2">总资产 (折合人民币)</div>
          <div className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">
            ¥{(Number(totalAssetsCNY) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      
      {/* 三个市场账户 */}
      <div className="grid md:grid-cols-3 gap-4">
        {accounts.map((account) => {
          const config = MARKET_CONFIG[account.market];
          const hasPositions = account.positions.length > 0;
          
          return (
            <div key={account.market} className={cn(
              "card overflow-hidden",
              !account.isActive && "opacity-60"
            )}>
              {/* 账户头部 */}
              <div className={cn(
                "p-4 border-b border-[var(--border-light)]",
                account.market === 'CN' && "bg-red-500/10",
                account.market === 'HK' && "bg-blue-500/10",
                account.market === 'US' && "bg-green-500/10",
              )}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{config.flag}</span>
                  <div>
                    <div className="font-bold text-lg">{config.name}账户</div>
                    <div className="text-xs text-[var(--text-muted)]">{config.rules}</div>
                  </div>
                </div>
              </div>
              
              {/* 账户金额 */}
              <div className="p-4">
                <div className="text-center mb-4">
                  <div className="text-sm text-[var(--text-muted)]">账户总值</div>
                  <div className={cn("text-2xl font-bold tabular-nums", config.color)}>
                    {formatCurrency(account.total, account.market)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-[var(--bg-secondary)] rounded p-2 text-center">
                    <div className="text-xs text-[var(--text-muted)]">可用资金</div>
                    <div className="font-mono tabular-nums">{formatCurrency(account.balance, account.market)}</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded p-2 text-center">
                    <div className="text-xs text-[var(--text-muted)]">持仓市值</div>
                    <div className="font-mono tabular-nums">{formatCurrency(account.marketValue, account.market)}</div>
                  </div>
                </div>
                
                {/* 交易时间 */}
                <div className="mt-3 text-xs text-center text-[var(--text-muted)]">
                  交易时间：{config.hours}
                </div>
                
                {/* 持仓预览 */}
                {hasPositions && (
                  <div className="mt-4 pt-3 border-t border-[var(--border-light)]">
                    <div className="text-xs text-[var(--text-muted)] mb-2">持仓 ({account.positions.length})</div>
                    <div className="space-y-1">
                      {account.positions.slice(0, 3).map((pos: any) => {
                        const pnlPct = toNumber(pos.unrealizedPnlPct) * 100;
                        const isUp = pnlPct >= 0;
                        return (
                          <div key={pos.stockCode} className="flex justify-between text-sm">
                            <span className="truncate flex-1">{pos.stockName}</span>
                            <span className={cn("font-mono tabular-nums", isUp ? "text-up" : "text-down")}>
                              {isUp ? '+' : ''}{safeFixed(pnlPct, 2)}%
                            </span>
                          </div>
                        );
                      })}
                      {account.positions.length > 3 && (
                        <div className="text-xs text-[var(--text-muted)] text-center">
                          还有 {account.positions.length - 3} 只...
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 未开通提示 */}
                {!account.isActive && (
                  <div className="mt-4 pt-3 border-t border-[var(--border-light)] text-center">
                    <div className="text-sm text-[var(--text-muted)]">即将开通</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">敬请期待</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* 说明 */}
      <div className="card p-4 text-center text-sm text-[var(--text-muted)]">
        💡 各市场独立账户: A股100万¥ / 港股100万HK$ / 美股10万$
      </div>
    </div>
  );
}

function PositionsTab({ agentId, market }: { agentId: string; market: string }) {
  const { data: posData, isLoading } = useSWR(`/v1/portal/agents/${agentId}/positions?market=${market}`, fetcher);
  const data: any = posData;
  const symbol = MARKET_SYMBOL[market] || '¥';
  
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
          <span className="font-semibold">{symbol}{safeFixed(data.cash, 2)}</span>
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
  const { data: tradeData, isLoading } = useSWR(`/v1/portal/agents/${agentId}/trades?page=${page}&limit=20`, fetcherWithPagination);
  const data: any = tradeData;
  
  if (isLoading) {
    return <div className="card p-4 animate-pulse"><div className="h-40 bg-[var(--bg-hover)] rounded"></div></div>;
  }
  
  if (!data?.data?.length) {
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
