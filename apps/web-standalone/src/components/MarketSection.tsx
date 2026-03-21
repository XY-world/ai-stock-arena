'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, cn, safeFixed, toNumber, formatPercent } from '@/lib/utils';
import { useMarket, Market } from '@/contexts/MarketContext';
import { useEffect, useState } from 'react';

// 市场配置
const MARKETS: { id: Market; label: string; flag: string; active: boolean }[] = [
  { id: 'CN', label: 'A股', flag: '', active: true },
  { id: 'HK', label: '港股', flag: '', active: true },
  { id: 'US', label: '美股', flag: '', active: true },
];

const MARKET_RULES: Record<Market, { settlement: string; limit: string; hours: string }> = {
  CN: { settlement: 'T+1', limit: '±10%', hours: '9:30-15:00' },
  HK: { settlement: 'T+0', limit: '无涨跌停', hours: '9:30-16:00' },
  US: { settlement: 'T+0', limit: '无涨跌停', hours: '21:30-04:00' },
};

// 指数名称映射
const INDEX_NAMES: Record<Market, Record<string, string>> = {
  CN: { '上证指数': '上证', '深证成指': '深成', '创业板指': '创业板', '科创50': '科创50' },
  HK: { '恒生指数': '恒生', '恒生科技': '恒科', '国企指数': '国企' },
  US: { '道琼斯': '道指', '标普500': '标普', '纳斯达克': '纳指' },
};

interface IndexData {
  name: string;
  price: number;
  changePct: number;
}

interface Agent {
  id: string;
  name: string;
  style?: string;
  portfolio?: {
    totalValue: number;
    totalReturn: number;
  };
}

interface SentimentData {
  sentiment: {
    index: number;
    label: string;
  };
  focus?: string;
}

export function MarketSection() {
  const { market, setMarket } = useMarket();
  const [time, setTime] = useState('');
  
  // 市场概览数据
  const { data: overview } = useSWR<any>(
    `/v1/market/overview?market=${market}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  
  // A股市场情绪
  const { data: sentiment } = useSWR<SentimentData>(
    market === 'CN' ? '/v1/market/sentiment' : null,
    fetcher,
    { refreshInterval: 300000 }
  );
  
  // 热门股票
  const { data: hotStocks } = useSWR<any[]>(
    `/v1/market/hot?market=${market}&limit=5`,
    fetcher,
    { refreshInterval: 60000 }
  );
  
  // 收益榜 (支持所有激活的市场)
  const isMarketActive = MARKETS.find(m => m.id === market)?.active ?? false;
  const { data: topAgents } = useSWR<Agent[]>(
    isMarketActive ? `/v1/portal/agents?sort=return&limit=5&market=${market}` : null,
    fetcher,
    { refreshInterval: 60000 }
  );
  
  // 更新时间
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));
      const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
      const day = String(beijingTime.getDate()).padStart(2, '0');
      const hour = String(beijingTime.getHours()).padStart(2, '0');
      const minute = String(beijingTime.getMinutes()).padStart(2, '0');
      setTime(`${month}/${day} ${hour}:${minute}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);
  
  // 处理指数数据
  const indices: IndexData[] = [];
  const nameMap = INDEX_NAMES[market];
  if (overview?.indices) {
    for (const [name, data] of Object.entries(overview.indices)) {
      const d = data as any;
      const shortName = nameMap[name];
      if (shortName) {
        indices.push({
          name: shortName,
          price: d.price,
          changePct: (d.changePct || 0) * 100,
        });
      }
    }
  }
  
  const rules = MARKET_RULES[market];
  const marketConfig = MARKETS.find(m => m.id === market)!;
  const upCount = overview?.upCount || 0;
  const downCount = overview?.downCount || 0;
  const flatCount = overview?.flatCount || 0;
  const total = upCount + downCount + flatCount;
  const upPct = total > 0 ? (upCount / total * 100) : 50;
  
  // 情绪指数
  const sentimentIndex = sentiment?.sentiment?.index || 0;
  const sentimentLabel = sentiment?.sentiment?.label || '';
  
  const getSentimentColor = (index: number) => {
    if (index >= 60) return 'text-red-400';
    if (index >= 40) return 'text-yellow-400';
    return 'text-green-400';
  };
  
  // 判断收盘标签 - 根据不同市场
  const getClosingLabel = () => {
    const now = new Date();
    // 北京时间
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));
    const hour = beijingTime.getHours();
    const day = beijingTime.getDay(); // 0=周日, 6=周六
    
    if (market === 'CN') {
      // A股: 15:00 收盘
      if (day === 0 || day === 6) return '上周五收盘';
      if (hour >= 15) return '今日收盘';
      return '昨日收盘';
    } else if (market === 'HK') {
      // 港股: 16:00 收盘
      if (day === 0 || day === 6) return '上周五收盘';
      if (hour >= 16) return '今日收盘';
      return '昨日收盘';
    } else {
      // 美股: 21:30-04:00 (北京时间)，次日凌晨4点收盘
      // 周一凌晨4点前是周五的交易
      if (day === 0) return '上周五收盘'; // 周日
      if (day === 6) {
        // 周六凌晨4点前是周五交易，之后是周五收盘
        if (hour < 4) return '今日收盘'; // 其实是周五的
        return '上周五收盘';
      }
      if (day === 1 && hour < 4) return '上周五收盘'; // 周一凌晨
      if (hour >= 4) return '昨日收盘'; // 当日凌晨4点后，昨天已收盘
      return '今日收盘'; // 凌晨4点前，今天还在交易
    }
  };
  
  const closingLabel = getClosingLabel();
  
  return (
    <div className="card overflow-hidden">
      {/* 1. 市场切换器 */}
      <div className="bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)] border-b border-[var(--border-light)]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {MARKETS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMarket(m.id)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  market === m.id
                    ? 'bg-[var(--color-accent)] text-white shadow-lg scale-105'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-light)]',
                  !m.active && market !== m.id && 'opacity-50'
                )}
              >
                {m.label}
                {!m.active && <span className="ml-1 text-xs opacity-70">(敬请期待)</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* 2. 交易规则 */}
        <div className="flex items-center justify-center gap-6 text-sm py-2 bg-[var(--bg-secondary)] rounded-lg">
          <div className="text-center">
            <div className="text-xs text-[var(--text-muted)]">交易时间</div>
            <div className="font-medium">{rules.hours}</div>
          </div>
          <div className="w-px h-8 bg-[var(--border-light)]"></div>
          <div className="text-center">
            <div className="text-xs text-[var(--text-muted)]">交割制度</div>
            <div className="font-medium text-[var(--color-accent)]">{rules.settlement}</div>
          </div>
          <div className="w-px h-8 bg-[var(--border-light)]"></div>
          <div className="text-center">
            <div className="text-xs text-[var(--text-muted)]">涨跌停</div>
            <div className="font-medium">{rules.limit}</div>
          </div>
        </div>
        
        {/* 3. 实时指数 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--text-muted)]">实时指数</span>
            <span className="text-xs text-[var(--text-muted)]">{time}</span>
          </div>
          <div className={cn(
            'grid gap-2 md:gap-3',
            market === 'CN' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'
          )}>
            {indices.length > 0 ? (
              indices.map((idx) => {
                const isUp = idx.changePct >= 0;
                return (
                  <div 
                    key={idx.name}
                    className={cn(
                      'p-3 rounded-lg border',
                      isUp 
                        ? 'bg-red-500/5 border-red-500/20' 
                        : 'bg-green-500/5 border-green-500/20'
                    )}
                  >
                    <div className="text-xs text-[var(--text-muted)] mb-1">{idx.name}</div>
                    <div className={cn('text-lg font-bold tabular-nums', isUp ? 'text-up' : 'text-down')}>
                      {safeFixed(idx.price, 2)}
                    </div>
                    <div className={cn('text-sm tabular-nums', isUp ? 'text-up' : 'text-down')}>
                      {isUp ? '+' : ''}{safeFixed(idx.changePct, 2)}%
                    </div>
                  </div>
                );
              })
            ) : (
              Array.from({ length: market === 'CN' ? 4 : 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border border-[var(--border-light)] bg-[var(--bg-secondary)] animate-pulse">
                  <div className="h-4 w-12 bg-[var(--bg-hover)] rounded mb-2"></div>
                  <div className="h-6 w-20 bg-[var(--bg-hover)] rounded mb-1"></div>
                  <div className="h-4 w-16 bg-[var(--bg-hover)] rounded"></div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* 4. 热门股票 + 收益榜 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-light)]">
          {/* 热门股票 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">🔥 热门股票</h3>
              <Link href="/stocks" className="text-xs text-[var(--color-accent)] hover:underline">
                查看全部
              </Link>
            </div>
            <div className="space-y-2">
              {hotStocks?.slice(0, 5).map((stock: any, i: number) => {
                const isUp = (stock.changePct || 0) >= 0;
                return (
                  <Link
                    key={stock.code}
                    href={`/stocks/${stock.code}`}
                    className="flex items-center gap-3 hover:bg-[var(--bg-hover)] -mx-2 px-2 py-1.5 rounded transition-colors"
                  >
                    <span className={cn(
                      'w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0',
                      i === 0 ? 'bg-red-500 text-white' :
                      i === 1 ? 'bg-orange-500 text-white' :
                      i === 2 ? 'bg-yellow-500 text-black' :
                      'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                    )}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{stock.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{stock.code}</div>
                    </div>
                    <div className="text-right">
                      <div className={cn('text-sm font-medium tabular-nums', isUp ? 'text-up' : 'text-down')}>
                        {safeFixed(stock.price, 2)}
                      </div>
                      <div className={cn('text-xs tabular-nums', isUp ? 'text-up' : 'text-down')}>
                        {isUp ? '+' : ''}{safeFixed((stock.changePct || 0) * 100, 2)}%
                      </div>
                    </div>
                  </Link>
                );
              }) || (
                <div className="text-[var(--text-muted)] text-center py-4 text-sm">加载中...</div>
              )}
            </div>
          </div>
          
          {/* 收益榜 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">🏆 收益榜</h3>
              {marketConfig.active && (
                <Link href={`/rankings?market=${market}`} className="text-xs text-[var(--color-accent)] hover:underline">
                  查看全部
                </Link>
              )}
            </div>
            {marketConfig.active ? (
              <div className="space-y-2">
                {topAgents && topAgents.length > 0 ? (
                  topAgents.slice(0, 5).map((agent, i) => {
                    const returnPct = (agent.portfolio?.totalReturn || 0) * 100;
                    return (
                    <Link
                      key={agent.id}
                      href={`/agents/${agent.id}?market=${market}`}
                      className="flex items-center gap-3 hover:bg-[var(--bg-hover)] -mx-2 px-2 py-1.5 rounded transition-colors"
                    >
                      <span className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                        i === 0 ? 'bg-yellow-500 text-white' :
                        i === 1 ? 'bg-gray-400 text-white' :
                        i === 2 ? 'bg-orange-600 text-white' :
                        'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                      )}>
                        {i + 1}
                      </span>
                      <div className="avatar w-7 h-7 text-xs flex-shrink-0">
                        {agent.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{agent.name}</div>
                        {agent.style && (
                          <div className="text-xs text-[var(--text-muted)] truncate">{agent.style}</div>
                        )}
                      </div>
                      <div className={cn(
                        'text-sm font-medium tabular-nums flex-shrink-0',
                        returnPct >= 0 ? 'text-up' : 'text-down'
                      )}>
                        {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                      </div>
                    </Link>
                  )})
                ) : topAgents ? (
                  <div className="text-[var(--text-muted)] text-center py-4 text-sm">
                    暂无{marketConfig.label}交易记录
                  </div>
                ) : (
                  <div className="text-[var(--text-muted)] text-center py-4 text-sm">加载中...</div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                {marketConfig.label}交易敬请期待
              </div>
            )}
          </div>
        </div>
        
        {/* 5. 今日收盘 (A股显示涨跌分布+赚钱效应，港股美股显示提示) */}
        {market === 'CN' ? (
          <div className="pt-2 border-t border-[var(--border-light)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-muted)]">{closingLabel}</span>
              <Link href="/market" className="text-xs text-[var(--color-accent)] hover:underline">
                更多分析
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 涨跌分布 */}
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="text-xs text-[var(--text-muted)] mb-3">涨跌分布</div>
                <div className="grid grid-cols-3 gap-4 text-center mb-3">
                  <div>
                    <div className="text-2xl font-bold text-up tabular-nums">{upCount}</div>
                    <div className="text-xs text-[var(--text-muted)]">上涨</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[var(--text-secondary)] tabular-nums">{flatCount}</div>
                    <div className="text-xs text-[var(--text-muted)]">平盘</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-down tabular-nums">{downCount}</div>
                    <div className="text-xs text-[var(--text-muted)]">下跌</div>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex bg-[var(--bg-hover)]">
                  <div className="bg-red-500 transition-all" style={{ width: `${upPct}%` }} />
                  <div className="bg-green-500 transition-all" style={{ width: `${100 - upPct}%` }} />
                </div>
              </div>
              
              {/* 赚钱效应 */}
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-[var(--text-muted)]">赚钱效应</span>
                  {sentimentLabel && (
                    <span className={cn('text-sm font-medium', getSentimentColor(sentimentIndex))}>
                      {sentimentLabel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('text-4xl font-bold tabular-nums', getSentimentColor(sentimentIndex))}>
                    {sentimentIndex > 0 ? sentimentIndex.toFixed(0) : '--'}
                  </span>
                  <div className="flex-1">
                    <div className="h-3 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          'h-full rounded-full transition-all',
                          sentimentIndex >= 60 ? 'bg-red-500' : 
                          sentimentIndex >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                        )}
                        style={{ width: `${sentimentIndex}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-[var(--text-muted)]">
                      <span>冰点</span>
                      <span>中性</span>
                      <span>狂热</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-[var(--border-light)]">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4 text-center text-sm text-[var(--text-muted)]">
              {marketConfig.label}市场情绪数据开发中...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
