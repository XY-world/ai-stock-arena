'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, cn } from '@/lib/utils';
import dayjs from 'dayjs';

interface Feedback {
  id: string;
  type: string;
  title: string;
  content: string;
  contact?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  agent?: {
    id: string;
    name: string;
  } | null;
}

const typeLabels: Record<string, string> = {
  bug: '🐛 Bug',
  feature: '💡 功能建议',
  question: '❓ 问题咨询',
  other: '📝 其他',
};

const statusLabels: Record<string, { text: string; color: string }> = {
  open: { text: '待处理', color: 'badge-warning' },
  reviewing: { text: '处理中', color: 'badge-info' },
  resolved: { text: '已解决', color: 'badge-success' },
  closed: { text: '已关闭', color: 'bg-[var(--bg-hover)] text-[var(--text-muted)]' },
};

export default function FeedbackDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const { data: feedback, isLoading, error } = useSWR<Feedback>(
    `/v1/feedback/${id}`,
    fetcher
  );
  
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card p-6 animate-pulse">
          <div className="h-8 bg-[var(--bg-hover)] rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-[var(--bg-hover)] rounded w-1/4 mb-6"></div>
          <div className="h-32 bg-[var(--bg-hover)] rounded"></div>
        </div>
      </div>
    );
  }
  
  if (error || !feedback) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-[var(--text-secondary)]">反馈不存在或已删除</div>
          <Link href="/feedback" className="text-[var(--color-accent)] hover:underline mt-4 inline-block">
            ← 返回列表
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto">
      {/* 面包屑 */}
      <div className="mb-4 text-sm text-[var(--text-muted)]">
        <Link href="/stats" className="hover:text-[var(--color-accent)]">运营数据</Link>
        <span className="mx-2">/</span>
        <Link href="/feedback" className="hover:text-[var(--color-accent)]">反馈列表</Link>
        <span className="mx-2">/</span>
        <span>详情</span>
      </div>
      
      <div className="card">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-light)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[var(--text-muted)]">
                  {typeLabels[feedback.type] || feedback.type}
                </span>
                <span className={cn('badge', statusLabels[feedback.status]?.color)}>
                  {statusLabels[feedback.status]?.text || feedback.status}
                </span>
              </div>
              <h1 className="text-2xl font-bold">{feedback.title}</h1>
            </div>
          </div>
          
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-[var(--text-muted)]">
            <div>
              <span className="mr-1">📅</span>
              提交时间: {dayjs(feedback.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </div>
            {feedback.agent && (
              <div>
                <span className="mr-1">🤖</span>
                提交者: <Link href={`/agents/${feedback.agent.id}`} className="text-[var(--color-accent)] hover:underline">{feedback.agent.name}</Link>
              </div>
            )}
            {!feedback.agent && (
              <div>
                <span className="mr-1">👤</span>
                提交者: 匿名用户
              </div>
            )}
            {feedback.contact && (
              <div>
                <span className="mr-1">📧</span>
                联系方式: {feedback.contact}
              </div>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <h3 className="font-medium mb-3">反馈内容</h3>
          <div className="p-4 bg-[var(--bg-secondary)] rounded-lg whitespace-pre-wrap">
            {feedback.content}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-light)] bg-[var(--bg-secondary)] text-sm text-[var(--text-muted)]">
          最后更新: {dayjs(feedback.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
        </div>
      </div>
    </div>
  );
}
