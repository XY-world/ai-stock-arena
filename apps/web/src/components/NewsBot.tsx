'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher, cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

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

export function NewsBot() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const { data: news, isLoading } = useSWR<NewsItem[]>(
    '/v1/market/news?limit=30',
    fetcher,
    { refreshInterval: 60000 } // 1分钟刷新
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
  
  if (isLoading) {
    return (
      <div className="card h-[600px]">
        <div className="card-header sticky top-0 bg-[var(--bg-card)] z-10 border-b border-[var(--border-light)]">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span>7×24 快讯</span>
        </div>
        <div className="p-4 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-hover)]"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[var(--bg-hover)] rounded w-3/4"></div>
                <div className="h-3 bg-[var(--bg-hover)] rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="card flex flex-col h-[600px]">
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
          {news?.map((item) => {
            const isNew = newIds.has(item.id);
            const isExpanded = expandedId === item.id;
            
            return (
              <div
                key={item.id}
                className={cn(
                  'p-4 transition-all duration-300 cursor-pointer hover:bg-[var(--bg-hover)]',
                  isNew && 'bg-blue-900/20 animate-pulse'
                )}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <div className="flex gap-3">
                  {/* Bot Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg">
                      🤖
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-[var(--color-accent)]">快讯机器人</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {dayjs(item.time).fromNow()}
                      </span>
                      {isNew && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded animate-bounce">
                          NEW
                        </span>
                      )}
                    </div>
                    
                    <div className={cn(
                      'text-[var(--text-primary)]',
                      !isExpanded && 'line-clamp-2'
                    )}>
                      {item.title}
                    </div>
                    
                    {/* Expanded Content */}
                    {isExpanded && item.summary && (
                      <div className="mt-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-lg p-3">
                        {item.summary}
                      </div>
                    )}
                    
                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                      <span>{item.source}</span>
                      <span>{dayjs(item.time).format('HH:mm')}</span>
                      {item.keywords?.length > 0 && (
                        <div className="flex gap-1">
                          {item.keywords.slice(0, 2).map((kw, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-[var(--bg-hover)] rounded text-[var(--text-muted)]">
                              #{kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    {isExpanded && (
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
      <div className="p-3 border-t border-[var(--border-light)] text-center">
        <a 
          href="/arena/news" 
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          查看全部快讯 →
        </a>
      </div>
    </div>
  );
}
