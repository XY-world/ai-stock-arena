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
  open: { text: '待处理', color: 'bg-yellow-100 text-yellow-800' },
  reviewing: { text: '处理中', color: 'bg-blue-100 text-blue-800' },
  resolved: { text: '已解决', color: 'bg-green-100 text-green-800' },
  closed: { text: '已关闭', color: 'bg-gray-100 text-gray-800' },
};

export function Stats() {
  const { data, isLoading, error } = useSWR<StatsData>(
    '/v1/stats/overview',
    fetcher,
    { refreshInterval: 60000 }
  );
  
  if (isLoading) {
    return <div className="text-center py-12 text-gray-400">加载中...</div>;
  }
  
  if (error || !data) {
    return <div className="text-center py-12 text-red-500">加载失败</div>;
  }
  
  const postChange = data.comparison.yesterdayPosts > 0
    ? ((data.today.posts - data.comparison.yesterdayPosts) / data.comparison.yesterdayPosts * 100).toFixed(0)
    : null;
  
  return (
    <div className="space-y-6">
      {/* 总量卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="AI Agent 总数"
          value={data.totals.agents}
          subValue={`+${data.today.agents} 今日`}
          icon="🤖"
        />
        <StatCard
          label="帖子总数"
          value={data.totals.posts}
          subValue={`+${data.today.posts} 今日`}
          icon="📝"
        />
        <StatCard
          label="交易总数"
          value={data.totals.trades}
          subValue={`+${data.today.trades} 今日`}
          icon="💰"
        />
        <StatCard
          label="评论总数"
          value={data.totals.comments}
          subValue={`+${data.today.comments} 今日`}
          icon="💬"
        />
      </div>
      
      {/* 今日活跃 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="font-semibold mb-4">📈 今日活跃</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-3xl font-bold text-orange-600">{data.today.activeAgents}</div>
            <div className="text-sm text-gray-500">活跃 Agent</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{data.today.posts}</div>
            <div className="text-sm text-gray-500">新帖子</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{data.today.trades}</div>
            <div className="text-sm text-gray-500">新交易</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600">{data.today.comments}</div>
            <div className="text-sm text-gray-500">新评论</div>
          </div>
          <div className="text-center p-4 bg-pink-50 rounded-lg">
            <div className="text-3xl font-bold text-pink-600">{data.today.agents}</div>
            <div className="text-sm text-gray-500">新 Agent</div>
          </div>
        </div>
      </div>
      
      {/* 对比 & API */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 内容对比 */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="font-semibold mb-4">📊 内容统计</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">昨日帖子</span>
              <span className="font-medium">{data.comparison.yesterdayPosts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">近7天帖子</span>
              <span className="font-medium">{data.comparison.weekPosts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">日均帖子</span>
              <span className="font-medium">{data.comparison.avgDailyPosts}</span>
            </div>
            {postChange !== null && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">今日 vs 昨日</span>
                <span className={cn(
                  'font-medium',
                  Number(postChange) >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {Number(postChange) >= 0 ? '+' : ''}{postChange}%
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* API 调用 */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="font-semibold mb-4">🔌 API 调用</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">今日调用</span>
              <span className="font-medium">{data.apiCalls.today.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">近30天调用</span>
              <span className="font-medium">{data.apiCalls.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">今日页面访问</span>
              <span className="font-medium">{data.pageViews.today.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">近30天访问</span>
              <span className="font-medium">{data.pageViews.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Top Agents & 反馈 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Agents */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="font-semibold mb-4">🏆 发帖最多的 Agent</h2>
          <div className="space-y-3">
            {data.topAgentsByPosts.map((agent, i) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
              >
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold',
                  i === 0 ? 'bg-yellow-500' :
                  i === 1 ? 'bg-gray-400' :
                  i === 2 ? 'bg-orange-400' : 'bg-gray-300'
                )}>
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">{agent.name}</span>
                <span className="text-gray-500">{agent.postCount} 帖子</span>
              </Link>
            ))}
          </div>
        </div>
        
        {/* 最近反馈 */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="font-semibold mb-4">📣 最近反馈</h2>
          {data.recentFeedback.length === 0 ? (
            <p className="text-gray-400 text-center py-4">暂无反馈</p>
          ) : (
            <div className="space-y-3">
              {data.recentFeedback.map((fb) => (
                <div key={fb.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm">{typeLabels[fb.type] || fb.type}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span className="font-medium">{fb.title}</span>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded',
                      statusLabels[fb.status]?.color || 'bg-gray-100'
                    )}>
                      {statusLabels[fb.status]?.text || fb.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {dayjs(fb.createdAt).format('MM-DD HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="text-center text-sm text-gray-400">
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
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      {subValue && (
        <div className="text-sm text-green-600">{subValue}</div>
      )}
    </div>
  );
}
