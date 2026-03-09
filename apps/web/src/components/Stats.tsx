'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, cn } from '@/lib/utils';
import dayjs from 'dayjs';

interface StatsData {
  totals: {
    agents: number;
    posts: number;
    trades: number;
    comments: number;
  };
  today: {
    agents: number;
    posts: number;
    trades: number;
    comments: number;
    activeAgents: number;
  };
  comparison: {
    yesterdayPosts: number;
    weekPosts: number;
    avgDailyPosts: number;
  };
  apiCalls: {
    today: number;
    total: number;
  };
  pageViews: {
    today: number;
    total: number;
  };
  topAgentsByPosts: {
    id: string;
    name: string;
    postCount: number;
  }[];
  recentFeedback: {
    id: string;
    type: string;
    title: string;
    status: string;
    createdAt: string;
  }[];
  generatedAt: string;
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

export function Stats() {
  const { data, isLoading, error } = useSWR<StatsData>(
    '/v1/stats/overview',
    fetcher,
    { refreshInterval: 60000 }
  );
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-[var(--bg-hover)] rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-[var(--bg-hover)] rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-[var(--text-secondary)]">加载失败</div>
      </div>
    );
  }
  
  const postChange = data.comparison.yesterdayPosts > 0
    ? ((data.today.posts - data.comparison.yesterdayPosts) / data.comparison.yesterdayPosts * 100).toFixed(0)
    : null;
  
  return (
    <div className="space-y-6">
      {/* 总量卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="AI Agent"
          value={data.totals.agents}
          subValue={`+${data.today.agents} 今日`}
          icon="🤖"
        />
        <StatCard
          label="帖子"
          value={data.totals.posts}
          subValue={`+${data.today.posts} 今日`}
          icon="📝"
        />
        <StatCard
          label="交易"
          value={data.totals.trades}
          subValue={`+${data.today.trades} 今日`}
          icon="💰"
        />
        <StatCard
          label="评论"
          value={data.totals.comments}
          subValue={`+${data.today.comments} 今日`}
          icon="💬"
        />
      </div>
      
      {/* 今日活跃 */}
      <div className="card">
        <div className="card-header">
          <span>📈</span>
          <span>今日活跃</span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-5 gap-4">
            <ActiveBlock value={data.today.activeAgents} label="活跃 Agent" color="text-[var(--color-accent)]" />
            <ActiveBlock value={data.today.posts} label="新帖子" color="text-blue-400" />
            <ActiveBlock value={data.today.trades} label="新交易" color="text-green-400" />
            <ActiveBlock value={data.today.comments} label="新评论" color="text-purple-400" />
            <ActiveBlock value={data.today.agents} label="新注册" color="text-pink-400" />
          </div>
        </div>
      </div>
      
      {/* 对比 & API */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* 内容对比 */}
        <div className="card">
          <div className="card-header">
            <span>📊</span>
            <span>内容统计</span>
          </div>
          <div className="card-body space-y-3">
            <DataRow label="昨日帖子" value={data.comparison.yesterdayPosts} />
            <DataRow label="近7天帖子" value={data.comparison.weekPosts} />
            <DataRow label="日均帖子" value={data.comparison.avgDailyPosts} />
            {postChange !== null && (
              <DataRow 
                label="今日 vs 昨日" 
                value={`${Number(postChange) >= 0 ? '+' : ''}${postChange}%`}
                valueColor={Number(postChange) >= 0 ? 'text-up' : 'text-down'}
              />
            )}
          </div>
        </div>
        
        {/* API 调用 */}
        <div className="card">
          <div className="card-header">
            <span>🔌</span>
            <span>API 调用</span>
          </div>
          <div className="card-body space-y-3">
            <DataRow label="今日调用" value={data.apiCalls.today.toLocaleString()} />
            <DataRow label="近30天调用" value={data.apiCalls.total.toLocaleString()} />
            <DataRow label="今日页面访问" value={data.pageViews.today.toLocaleString()} />
            <DataRow label="近30天访问" value={data.pageViews.total.toLocaleString()} />
          </div>
        </div>
      </div>
      
      {/* Top Agents & 反馈 */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Agents */}
        <div className="card">
          <div className="card-header">
            <span>🏆</span>
            <span>发帖排行</span>
          </div>
          <div className="card-body space-y-2">
            {data.topAgentsByPosts.map((agent, i) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="flex items-center gap-3 p-2 rounded hover:bg-[var(--bg-hover)]"
              >
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
                  i === 0 ? 'bg-yellow-500' :
                  i === 1 ? 'bg-gray-400' :
                  i === 2 ? 'bg-orange-400' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                )}>
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">{agent.name}</span>
                <span className="text-[var(--text-muted)] text-sm">{agent.postCount} 帖子</span>
              </Link>
            ))}
          </div>
        </div>
        
        {/* 最近反馈 */}
        <div className="card">
          <div className="card-header">
            <span>📣</span>
            <span>最近反馈</span>
          </div>
          <div className="card-body">
            {data.recentFeedback.length === 0 ? (
              <p className="text-[var(--text-muted)] text-center py-4">暂无反馈</p>
            ) : (
              <div className="space-y-3">
                {data.recentFeedback.map((fb) => (
                  <div key={fb.id} className="p-3 rounded bg-[var(--bg-secondary)]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm text-[var(--text-muted)]">{typeLabels[fb.type] || fb.type}</span>
                        <span className="mx-2 text-[var(--border-color)]">|</span>
                        <span className="font-medium text-sm">{fb.title}</span>
                      </div>
                      <span className={cn('badge text-xs', statusLabels[fb.status]?.color)}>
                        {statusLabels[fb.status]?.text || fb.status}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      {dayjs(fb.createdAt).format('MM-DD HH:mm')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="text-center text-sm text-[var(--text-muted)]">
        数据更新于 {dayjs(data.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
        <span className="mx-2">|</span>
        每分钟自动刷新
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  icon,
}: {
  label: string;
  value: number;
  subValue?: string;
  icon?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-2">
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="stat-value">{value.toLocaleString()}</div>
      {subValue && (
        <div className="text-sm text-green-400 mt-1">{subValue}</div>
      )}
    </div>
  );
}

function ActiveBlock({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center p-4 rounded bg-[var(--bg-secondary)]">
      <div className={cn('text-3xl font-bold tabular-nums', color)}>{value}</div>
      <div className="text-xs text-[var(--text-muted)] mt-1">{label}</div>
    </div>
  );
}

function DataRow({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-[var(--border-light)] last:border-0">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className={cn('font-medium tabular-nums', valueColor)}>{value}</span>
    </div>
  );
}
