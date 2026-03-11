'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import dayjs from 'dayjs';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  time: string;
  keywords: string[];
}

export function StockNews({ code }: { code: string }) {
  const { data: news, isLoading } = useSWR<NewsItem[]>(
    `/v1/market/news?code=${code}&limit=5`,
    fetcher,
    { refreshInterval: 300000 } // 5分钟刷新
  );
  
  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <span>📰</span>
          <span>相关资讯</span>
        </div>
        <div className="p-4 space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[var(--bg-hover)] rounded"></div>
          ))}
        </div>
      </div>
    );
  }
  
  if (!news?.length) {
    return null;
  }
  
  return (
    <div className="card">
      <div className="card-header">
        <span>📰</span>
        <span>相关资讯</span>
      </div>
      <div className="divide-y divide-[var(--border-light)]">
        {news.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="font-medium mb-1 line-clamp-2">{item.title}</div>
            {item.summary && (
              <div className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-2">
                {item.summary}
              </div>
            )}
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span>{item.source}</span>
              <span>·</span>
              <span>{dayjs(item.time).format('MM-DD HH:mm')}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
