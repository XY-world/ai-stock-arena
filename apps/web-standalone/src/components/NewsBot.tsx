'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher, cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import Link from 'next/link';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  time: string;
  keywords: string[];
}

interface NewsBotProps {
  compact?: boolean;
}

export function NewsBot({ compact = false }: NewsBotProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const { data: news, isLoading } = useSWR<NewsItem[]>(
    '/v1/market/news?limit=30',
    fetcher,
    { refreshInterval: 60000 }
  );
  
  // 新消息动画
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    if (news?.length) {
      const latestIds = new Set(news.slice(0, 3).map(n => n.id));
      setNewIds(latestIds);
      const timer = setTimeout(() => setNewIds(new Set()), 3000);
      return () => clearTimeout(timer);
    }
  }, [news?.[0]?.id]);
  
  const displayNews = compact ? news?.slice(0, 8) : news;
  
  if (isLoading) {
    return (
      <div className="card h-full flex flex-col">
        <div className="card-header sticky top-0 bg-[var(--bg-card)] z-10 border-b border-[var(--border-light)]">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span>7×24 快讯</span>
        </div>
        <div className="flex-1 p-3 space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--bg-hover)] flex-shrink-0"></div>
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[var(--bg-hover)] rounded w-3/4"></div>
                <div className="h-2 bg-[var(--bg-hover)] rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="card flex flex-col h-full">
      {/* Header */}
      <div className="card-header sticky top-0 bg-[var(--bg-card)] z-10 border-b border-[var(--border-light)]">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
        <span>7×24 快讯</span>
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          实时更新
        </span>
      </div>
      
      {/* News Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-[var(--border-light)]">
          {displayNews?.map((item) => {
            const isNew = newIds.has(item.id);
            const isExpanded = expandedId === item.id;
            
            return (
              <div
                key={item.id}
                className={cn(
                  'p-3 transition-all duration-300 cursor-pointer hover:bg-[var(--bg-hover)]',
                  isNew && 'bg-blue-900/20 animate-pulse'
                )}
                onClick={() => !compact && setExpandedId(isExpanded ? null : item.id)}
              >
                <div className="flex gap-2">
                  {/* Bot Avatar */}
                  <div className="flex-shrink-0">
                    <div className={cn(
                      "rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white",
                      compact ? "w-8 h-8 text-sm" : "w-10 h-10 text-lg"
                    )}>
                      🤖
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn(
                        "font-medium text-[var(--color-accent)]",
                        compact ? "text-xs" : "text-sm"
                      )}>快讯机器人</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {dayjs(item.time).fromNow()}
                      </span>
                    </div>
                    
                    <div className={cn(
                      'text-[var(--text-primary)]',
                      compact ? 'text-sm line-clamp-2' : (!isExpanded && 'line-clamp-2')
                    )}>
                      {item.title}
                    </div>
                    
                    {/* Expanded Content - only in full mode */}
                    {!compact && isExpanded && item.summary && (
                      <div className="mt-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-lg p-3">
                        {item.summary}
                      </div>
                    )}
                    
                    {/* Meta - simplified in compact mode */}
                    {!compact && (
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--text-muted)]">
                        <span>{item.source}</span>
                        <span>{dayjs(item.time).format('HH:mm')}</span>
                      </div>
                    )}
                    
                    {/* Actions - only in full mode */}
                    {!compact && isExpanded && (
                      <div className="flex gap-3 mt-3">
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
        </div>
      </div>
      
      {/* Footer */}
      <div className="p-2 border-t border-[var(--border-light)] text-center">
        <Link 
          href="/news"
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          查看全部快讯 →
        </Link>
      </div>
    </div>
  );
}
