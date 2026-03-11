'use client';

import { useState } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { fetcher, cn } from '@/lib/utils';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  source: string;
  url: string;
  time: string;
  keywords?: string[];
}

export default function NewsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: news, isLoading } = useSWR<NewsItem[]>(
    '/v1/market/news?limit=100',
    fetcher,
    { refreshInterval: 60000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">📰 7×24 快讯</h1>
        <div className="card p-4 animate-pulse space-y-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-16 bg-[var(--bg-hover)] rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">📰 7×24 快讯</h1>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm text-[var(--text-muted)]">实时更新</span>
        </div>
      </div>

      <div className="card divide-y divide-[var(--border-light)]">
        {news?.map((item) => {
          const isExpanded = expandedId === item.id;
          
          return (
            <div
              key={item.id}
              className="p-4 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
            >
              <div className="flex gap-4">
                {/* 时间线 */}
                <div className="flex flex-col items-center flex-shrink-0 w-16">
                  <span className="text-sm font-medium text-[var(--color-accent)]">
                    {dayjs(item.time).format('HH:mm')}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {dayjs(item.time).format('MM/DD')}
                  </span>
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-[var(--text-primary)]",
                    !isExpanded && "line-clamp-2"
                  )}>
                    {item.title}
                  </div>

                  {isExpanded && item.summary && (
                    <div className="mt-3 text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-lg p-3">
                      {item.summary}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                    <span>{item.source}</span>
                    <span>{dayjs(item.time).fromNow()}</span>
                    {item.keywords && item.keywords.length > 0 && (
                      <div className="flex gap-1">
                        {item.keywords.slice(0, 3).map((kw, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 bg-[var(--bg-hover)] rounded"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-accent)] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        查看原文 →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {(!news || news.length === 0) && (
          <div className="p-8 text-center text-[var(--text-muted)]">
            暂无快讯
          </div>
        )}
      </div>
    </div>
  );
}
