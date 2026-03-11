'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { fetcher, cn } from '@/lib/utils';

export default function MarketPage() {
  const { data: sentiment }: { data: any } = useSWR('/v1/market/sentiment', fetcher, { refreshInterval: 300000 });
  const { data: themes }: { data: any } = useSWR('/v1/market/themes', fetcher, { refreshInterval: 300000 });
  const { data: ladder }: { data: any } = useSWR('/v1/market/ladder', fetcher, { refreshInterval: 300000 });
  const { data: hotStocks }: { data: any } = useSWR('/v1/market/hot', fetcher, { refreshInterval: 60000 });
  const { data: overview }: { data: any } = useSWR('/v1/market/overview', fetcher, { refreshInterval: 60000 });

  const sentimentIndex = sentiment?.sentiment?.index ?? 0;
  const sentimentLabel = sentiment?.sentiment?.label ?? '';

  const getSentimentColor = (index: number) => {
    if (index >= 60) return 'text-red-400';
    if (index >= 40) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getSentimentBg = (index: number) => {
    if (index >= 60) return 'from-red-500/30 to-red-500/5';
    if (index >= 40) return 'from-yellow-500/30 to-yellow-500/5';
    return 'from-green-500/30 to-green-500/5';
  };

  const getSentimentBarColor = (index: number) => {
    if (index >= 60) return 'bg-red-500';
    if (index >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // 处理指数数据 - API 返回的是对象，需要转换成数组
  const indicesList: Array<{name: string, price: number, changePct: number}> = [];
  if (overview?.indices && typeof overview.indices === 'object') {
    for (const [name, data] of Object.entries(overview.indices)) {
      const d = data as any;
      indicesList.push({
        name,
        price: d.price ?? 0,
        changePct: (d.changePct ?? 0) * 100,
      });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📊 市场情绪</h1>

      {/* 情绪指数大卡片 */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 赚钱效应 */}
          <div className={cn("rounded-xl p-6 bg-gradient-to-br", getSentimentBg(sentimentIndex))}>
            <div className="text-sm text-[var(--text-muted)] mb-2">赚钱效应</div>
            <div className="flex items-end gap-2 mb-3">
              <span className={cn("text-5xl font-bold tabular-nums", getSentimentColor(sentimentIndex))}>
                {sentimentIndex.toFixed(1)}
              </span>
              <span className="text-[var(--text-muted)] mb-2">%</span>
            </div>
            <div className={cn("text-lg font-medium", getSentimentColor(sentimentIndex))}>
              {sentimentLabel}
            </div>
            <div className="mt-4 h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", getSentimentBarColor(sentimentIndex))}
                style={{ width: `${sentimentIndex}%` }}
              />
            </div>
          </div>

          {/* 涨跌分布 */}
          {sentiment?.sentiment && (
            <div className="rounded-xl p-6 bg-[var(--bg-secondary)]">
              <div className="text-sm text-[var(--text-muted)] mb-4">涨跌分布</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-up">上涨</span>
                  <span className="text-2xl font-bold text-up tabular-nums">{sentiment.sentiment.upCount ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">平盘</span>
                  <span className="text-2xl font-bold text-[var(--text-secondary)] tabular-nums">{sentiment.sentiment.flatCount ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-down">下跌</span>
                  <span className="text-2xl font-bold text-down tabular-nums">{sentiment.sentiment.downCount ?? 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* 连板天梯 */}
          {ladder && (
            <div className="rounded-xl p-6 bg-[var(--bg-secondary)]">
              <div className="text-sm text-[var(--text-muted)] mb-4">🪜 连板天梯</div>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl font-bold text-[var(--color-accent)]">{ladder.maxStreak ?? 0}板</span>
                {ladder.topStreak && (
                  <div>
                    <div className="font-medium">{ladder.topStreak.name}</div>
                    <div className="text-sm text-[var(--text-muted)]">{ladder.topStreak.industry}</div>
                  </div>
                )}
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                今日涨停 <span className="text-up font-medium">{ladder.totalLimitUp ?? 0}</span> 家
              </div>
            </div>
          )}
        </div>

        {/* 资金聚焦 */}
        {sentiment?.focus && (
          <div className="mt-6 p-4 bg-[var(--bg-secondary)] rounded-lg">
            <span className="text-[var(--text-muted)]">💰 资金聚焦：</span>
            <span className="text-[var(--text-primary)]">{sentiment.focus}</span>
          </div>
        )}
      </div>

      {/* 大盘指数 */}
      {indicesList.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">📊 大盘指数</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {indicesList.map((idx) => {
              const isUp = idx.changePct >= 0;
              return (
                <div key={idx.name} className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                  <div className="text-sm text-[var(--text-muted)] mb-1">{idx.name}</div>
                  <div className={cn("text-xl font-bold tabular-nums", isUp ? "text-up" : "text-down")}>
                    {idx.price.toFixed(2)}
                  </div>
                  <div className={cn("text-sm tabular-nums", isUp ? "text-up" : "text-down")}>
                    {isUp ? '+' : ''}{idx.changePct.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 热门题材 */}
      {themes?.themes && themes.themes.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">🔥 热门题材</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {themes.themes.map((theme: any, i: number) => (
              <div
                key={theme.name}
                className="flex items-center gap-3 p-4 bg-[var(--bg-secondary)] rounded-lg"
              >
                <span className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                  i === 0 ? "bg-red-500 text-white" :
                  i === 1 ? "bg-orange-500 text-white" :
                  i === 2 ? "bg-yellow-500 text-black" :
                  "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                )}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="font-medium">{theme.name}</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    涨停 {theme.limitUpCount ?? 0} 家
                  </div>
                </div>
                <div className={cn(
                  "text-sm font-medium tabular-nums",
                  (theme.netFlow ?? 0) >= 0 ? "text-up" : "text-down"
                )}>
                  {(theme.netFlow ?? 0) >= 0 ? '+' : ''}{(theme.netFlow ?? 0).toFixed(1)}亿
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 热门股票 */}
      {hotStocks && hotStocks.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">📈 热门股票</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {hotStocks.slice(0, 12).map((stock: any, i: number) => {
              const changePct = (stock.changePct ?? 0) * 100;
              const isUp = changePct >= 0;
              return (
                <Link
                  key={stock.code}
                  href={`/stocks/${stock.code}`}
                  className="p-4 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "w-6 h-6 rounded flex items-center justify-center text-xs font-bold",
                      i < 3 ? "bg-red-500 text-white" : "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                    )}>
                      {i + 1}
                    </span>
                    <span className={cn(
                      "text-sm font-medium tabular-nums",
                      isUp ? "text-up" : "text-down"
                    )}>
                      {isUp ? '+' : ''}{changePct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="font-medium">{stock.name}</div>
                  <div className="text-sm text-[var(--text-muted)]">{stock.code}</div>
                  <div className={cn(
                    "text-lg font-bold tabular-nums mt-1",
                    isUp ? "text-up" : "text-down"
                  )}>
                    ¥{(stock.price ?? 0).toFixed(2)}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
