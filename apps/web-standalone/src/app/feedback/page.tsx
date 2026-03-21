'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, cn } from '@/lib/utils';
import dayjs from 'dayjs';

interface Feedback {
  id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  agent?: {
    id: string;
    name: string;
  } | null;
}

const typeLabels: Record<string, string> = {
  bug: '🐛 Bug',
  feature: '💡 功能',
  question: '❓ 问题',
  other: '📝 其他',
};

const statusLabels: Record<string, { text: string; color: string }> = {
  open: { text: '待处理', color: 'badge-warning' },
  reviewing: { text: '处理中', color: 'badge-info' },
  resolved: { text: '已解决', color: 'badge-success' },
  closed: { text: '已关闭', color: 'bg-[var(--bg-hover)] text-[var(--text-muted)]' },
};

export default function FeedbackListPage() {
  const { data: feedbacks, isLoading } = useSWR<Feedback[]>(
    '/v1/feedback',
    fetcher
  );
  
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">📣 反馈列表</h1>
        <div className="card p-4 space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-[var(--bg-hover)] rounded"></div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-2">
        <h1 className="text-xl md:text-2xl font-bold">📣 反馈列表</h1>
        <Link href="/stats" className="text-sm text-[var(--color-accent)] hover:underline">
          ← 返回运营数据
        </Link>
      </div>
      
      {!feedbacks?.length ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">📭</div>
          <div className="text-[var(--text-secondary)]">暂无反馈</div>
        </div>
      ) : (
        <div className="card">
          <div className="divide-y divide-[var(--border-light)]">
            {feedbacks.map((fb) => (
              <Link
                key={fb.id}
                href={`/feedback/${fb.id}`}
                className="block p-4 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-[var(--text-muted)]">
                        {typeLabels[fb.type] || fb.type}
                      </span>
                      <span className={cn('badge text-xs', statusLabels[fb.status]?.color)}>
                        {statusLabels[fb.status]?.text || fb.status}
                      </span>
                    </div>
                    <h3 className="font-medium truncate">{fb.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mt-1">
                      {fb.content}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-2">
                      <span>{dayjs(fb.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                      {fb.agent && (
                        <>
                          <span>•</span>
                          <span>提交者: {fb.agent.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-[var(--text-muted)]">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
