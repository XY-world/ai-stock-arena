'use client';

import useSWR from 'swr';
import { fetcher, cn } from '@/lib/utils';
import Link from 'next/link';
import { useMarket } from '@/contexts/MarketContext';

interface SentimentData {
  date: string;
  summary: string;
  focus: string;
  sentiment: {
    index: number;
    label: string;
    upCount: number;
    downCount: number;
    flatCount: number;
    total: number;
  };
  highlights: {
    theme: string;
    hotmoney: string;
    news: string;
  };
}

interface ThemesData {
  date: string;
  themes: {
    name: string;
    limitUpCount: number;
    netFlow: number;
    topStocks: string[];
  }[];
}

interface LadderData {
  date: string;
  totalLimitUp: number;
  maxStreak: number;
  topStreak: {
    name: string;
    boards: number;
    industry: string;
  };
}

export function MarketSentiment() {
  const { market, marketLabel, marketFlag } = useMarket();
  
  // A股使用韭研数据，港股暂用基础数据
  const { data: sentiment } = useSWR<SentimentData>(
    market === 'CN' ? '/v1/market/sentiment' : null,
    fetcher,
    { refreshInterval: 300000 }
  );
  
  // 获取港股/美股的 sentiment 数据
  const { data: globalSentiment } = useSWR<any>(
    market !== 'CN' ? `/v1/market/sentiment?market=${market}` : null,
    fetcher,
    { refreshInterval: 300000 }
  );
  
  const { data: overview } = useSWR<any>(
    `/v1/market/overview?market=${market}`,
    fetcher,
    { refreshInterval: 60000 }
  );
  
  const { data: themes } = useSWR<ThemesData>(
    market === 'CN' ? '/v1/market/themes' : null,
    fetcher,
    { refreshInterval: 300000 }
  );
  
  const { data: ladder } = useSWR<LadderData>(
    market === 'CN' ? '/v1/market/ladder' : null,
    fetcher,
    { refreshInterval: 300000 }
  );
  
  const sentimentIndex = sentiment?.sentiment?.index || 0;
  const sentimentLabel = sentiment?.sentiment?.label || '';
  
  // 优先使用 overview 的涨跌数据（更准确）
  const upCount = overview?.upCount ?? sentiment?.sentiment?.upCount ?? 0;
  const downCount = overview?.downCount ?? sentiment?.sentiment?.downCount ?? 0;
  const flatCount = overview?.flatCount ?? sentiment?.sentiment?.flatCount ?? 0;
  
  // 情绪颜色
  const getSentimentColor = (index: number) => {
    if (index >= 60) return 'text-red-400';
    if (index >= 40) return 'text-yellow-400';
    return 'text-green-400';
  };
  
  const getSentimentBg = (index: number) => {
    if (index >= 60) return 'from-red-500/20 to-red-500/5';
    if (index >= 40) return 'from-yellow-500/20 to-yellow-500/5';
    return 'from-green-500/20 to-green-500/5';
  };
  
  // 港股/美股简化视图
  if (market === 'HK' || market === 'US') {
    const marketInfo = market === 'HK' 
      ? { rules: 'T+0', noLimit: '无涨跌停', hours: '9:30-12:00, 13:00-16:00' }
      : { rules: 'T+0', noLimit: '无涨跌停', hours: '21:30-04:00 (北京时间)' };
    
    // 从 globalSentiment 获取赚钱效应数据
    const globalIndex = globalSentiment?.sentiment?.index || 0;
    const globalLabel = globalSentiment?.sentiment?.label || '';
    const globalUp = overview?.upCount ?? globalSentiment?.sentiment?.upCount ?? 0;
    const globalDown = overview?.downCount ?? globalSentiment?.sentiment?.downCount ?? 0;
    const globalFlat = overview?.flatCount ?? globalSentiment?.sentiment?.flatCount ?? 0;
    const totalAmount = overview?.totalAmountFormatted || globalSentiment?.totalAmountFormatted || '';
    
    return (
      <div className="card">
        <div className="card-header border-b border-[var(--border-light)]">
          <span>📊</span>
          <span>{marketFlag} 市场概况</span>
          {globalSentiment?.date && (
            <span className="ml-auto text-xs text-[var(--text-muted)]">
              {globalSentiment.date}
            </span>
          )}
        </div>
        
        <div className="p-4 space-y-4">
          {/* 赚钱效应 */}
          {globalIndex > 0 && (
            <div className={cn(
              'rounded-lg p-4 bg-gradient-to-r',
              getSentimentBg(globalIndex)
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-muted)]">赚钱效应</span>
                <span className={cn('text-sm font-medium', getSentimentColor(globalIndex))}>
                  {globalLabel}
                </span>
              </div>
              <div className="flex items-end gap-2">
                <span className={cn('text-4xl font-bold tabular-nums', getSentimentColor(globalIndex))}>
                  {globalIndex.toFixed(1)}
                </span>
                <span className="text-[var(--text-muted)] mb-1">%</span>
              </div>
              
              {/* 进度条 */}
              <div className="mt-3 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    globalIndex >= 60 ? 'bg-red-500' : 
                    globalIndex >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                  )}
                  style={{ width: `${globalIndex}%` }}
                />
              </div>
            </div>
          )}
          
          {/* 涨跌分布 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
              <div className="text-lg font-bold text-up tabular-nums">
                {globalUp}
              </div>
              <div className="text-xs text-[var(--text-muted)]">上涨</div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
              <div className="text-lg font-bold text-[var(--text-secondary)] tabular-nums">
                {globalFlat}
              </div>
              <div className="text-xs text-[var(--text-muted)]">平盘</div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
              <div className="text-lg font-bold text-down tabular-nums">
                {globalDown}
              </div>
              <div className="text-xs text-[var(--text-muted)]">下跌</div>
            </div>
          </div>
          
          {/* 成交额 */}
          {totalAmount && (
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">成交额</span>
                <span className="text-lg font-bold text-[var(--color-accent)]">
                  {totalAmount}
                </span>
              </div>
            </div>
          )}
          
          {/* 市场特色 */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-2">
            <div className="text-sm">
              <span className="text-[var(--text-muted)]">交易规则：</span>
              <span className="font-medium text-[var(--color-accent)]">{marketInfo.rules}</span>
              <span className="text-[var(--text-muted)]"> · {marketInfo.noLimit}</span>
            </div>
            <div className="text-sm">
              <span className="text-[var(--text-muted)]">交易时间：</span>
              <span>{marketInfo.hours}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // A股完整视图
  return (
    <div className="card">
      <div className="card-header border-b border-[var(--border-light)]">
        <span>📊</span>
        <span>市场情绪</span>
        {sentiment?.date && (
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            {sentiment.date}
          </span>
        )}
      </div>
      
      <div className="p-4 space-y-4">
        {/* 情绪指数 */}
        <div className={cn(
          'rounded-lg p-4 bg-gradient-to-r',
          getSentimentBg(sentimentIndex)
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text-muted)]">赚钱效应</span>
            <span className={cn('text-sm font-medium', getSentimentColor(sentimentIndex))}>
              {sentimentLabel}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <span className={cn('text-4xl font-bold tabular-nums', getSentimentColor(sentimentIndex))}>
              {sentimentIndex.toFixed(1)}
            </span>
            <span className="text-[var(--text-muted)] mb-1">%</span>
          </div>
          
          {/* 进度条 */}
          <div className="mt-3 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
            <div 
              className={cn(
                'h-full rounded-full transition-all duration-500',
                sentimentIndex >= 60 ? 'bg-red-500' : 
                sentimentIndex >= 40 ? 'bg-yellow-500' : 'bg-green-500'
              )}
              style={{ width: `${sentimentIndex}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-[var(--text-muted)]">
            <span>弱</span>
            <span>中</span>
            <span>强</span>
          </div>
        </div>
        
        {/* 涨跌分布 */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
            <div className="text-lg font-bold text-up tabular-nums">
              {upCount}
            </div>
            <div className="text-xs text-[var(--text-muted)]">上涨</div>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
            <div className="text-lg font-bold text-[var(--text-secondary)] tabular-nums">
              {flatCount}
            </div>
            <div className="text-xs text-[var(--text-muted)]">平盘</div>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
            <div className="text-lg font-bold text-down tabular-nums">
              {downCount}
            </div>
            <div className="text-xs text-[var(--text-muted)]">下跌</div>
          </div>
        </div>
        
        {/* 连板天梯 */}
        {ladder && (
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">🪜 连板天梯</span>
              <span className="text-xs text-[var(--text-muted)]">
                涨停 {ladder.totalLimitUp} 家
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-[var(--color-accent)]">
                {ladder.maxStreak}板
              </span>
              <div className="flex-1">
                <div className="font-medium">{ladder.topStreak?.name}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {ladder.topStreak?.industry}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 热门题材 */}
        {themes?.themes && themes.themes.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">🔥 热门题材</div>
            <div className="space-y-2">
              {themes.themes.slice(0, 5).map((theme, i) => (
                <div 
                  key={theme.name}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className={cn(
                    'w-5 h-5 rounded flex items-center justify-center text-xs font-bold',
                    i === 0 ? 'bg-red-500 text-white' :
                    i === 1 ? 'bg-orange-500 text-white' :
                    i === 2 ? 'bg-yellow-500 text-black' :
                    'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                  )}>
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate">{theme.name}</span>
                  <span className="text-up text-xs tabular-nums">
                    {theme.limitUpCount}涨停
                  </span>
                  <span className={cn(
                    'text-xs tabular-nums',
                    theme.netFlow >= 0 ? 'text-up' : 'text-down'
                  )}>
                    {theme.netFlow >= 0 ? '+' : ''}{theme.netFlow.toFixed(1)}亿
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 资金聚焦 */}
        {sentiment?.focus && (
          <div className="text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-lg p-3">
            <span className="text-[var(--text-muted)]">💰 资金聚焦：</span>
            {sentiment.focus}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="p-3 border-t border-[var(--border-light)] text-center">
        <Link 
          href="/market" 
          target="_blank"
          className="text-xs text-[var(--text-muted)] hover:text-[var(--color-accent)]"
        >
          更多市场数据 →
        </Link>
      </div>
    </div>
  );
}
