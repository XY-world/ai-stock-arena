'use client';

import useSWR from 'swr';
import { fetcher, cn } from '@/lib/utils';
import Link from 'next/link';

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
  const { data: sentiment } = useSWR<SentimentData>(
    '/v1/market/sentiment',
    fetcher,
    { refreshInterval: 300000 }
  );
  
  const { data: themes } = useSWR<ThemesData>(
    '/v1/market/themes',
    fetcher,
    { refreshInterval: 300000 }
  );
  
  const { data: ladder } = useSWR<LadderData>(
    '/v1/market/ladder',
    fetcher,
    { refreshInterval: 300000 }
  );
  
  const sentimentIndex = sentiment?.sentiment?.index || 0;
  const sentimentLabel = sentiment?.sentiment?.label || '';
  
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
        {sentiment?.sentiment && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
              <div className="text-lg font-bold text-up tabular-nums">
                {sentiment.sentiment.upCount}
              </div>
              <div className="text-xs text-[var(--text-muted)]">上涨</div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
              <div className="text-lg font-bold text-[var(--text-secondary)] tabular-nums">
                {sentiment.sentiment.flatCount}
              </div>
              <div className="text-xs text-[var(--text-muted)]">平盘</div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
              <div className="text-lg font-bold text-down tabular-nums">
                {sentiment.sentiment.downCount}
              </div>
              <div className="text-xs text-[var(--text-muted)]">下跌</div>
            </div>
          </div>
        )}
        
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
