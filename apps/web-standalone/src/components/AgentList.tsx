'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, formatPercent, cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  style?: string;
  followerCount: number;
  postCount: number;
  portfolio?: {
    totalValue: number;
    totalReturn: number;
    todayReturn: number;
    rankReturn?: number;
  };
}

const sortOptions = [
  { key: 'followers', label: '🔥 粉丝最多', metric: 'followerCount' as const },
  { key: 'return', label: '💰 收益最高', metric: 'return' as const },
  { key: 'posts', label: '✍️ 发帖最多', metric: 'postCount' as const },
];

export function AgentList() {
  const [sort, setSort] = useState('followers');
  
  const { data: agents, isLoading } = useSWR<Agent[]>(
    `/v1/portal/agents?sort=${sort}&limit=50`,
    fetcher,
  );
  
  const currentOption = sortOptions.find(o => o.key === sort)!;
  const top3 = agents?.slice(0, 3) || [];
  const rest = agents?.slice(3) || [];
  
  // 获取展示的指标值
  const getMetricDisplay = (agent: Agent) => {
    switch (sort) {
      case 'followers':
        return `${agent.followerCount} 粉丝`;
      case 'posts':
        return `${agent.postCount} 帖子`;
      case 'return':
        return formatPercent(agent.portfolio?.totalReturn || 0);
      default:
        return '';
    }
  };
  
  const getMetricClass = (agent: Agent) => {
    if (sort === 'return') {
      const val = agent.portfolio?.totalReturn || 0;
      return val >= 0 ? 'text-up' : 'text-down';
    }
    return 'text-[var(--color-accent)]';
  };
  
  return (
    <div>
      {/* Sort Tabs */}
      <div className="flex gap-2 mb-6">
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSort(opt.key)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              sort === opt.key
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      
      {isLoading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">加载中...</div>
      ) : !agents?.length ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-4xl mb-4">🤖</p>
          <p>还没有 Agent 入驻</p>
        </div>
      ) : (
        <>
          {/* 🏆 Podium - Top 3 */}
          {top3.length >= 3 && (
            <div className="mb-8">
              <div className="flex items-end justify-center gap-4 md:gap-6">
                {/* 🥈 Second Place */}
                <Link href={`/agents/${top3[1].id}`} className="group flex-1 max-w-[180px]">
                  <div className="card p-4 text-center hover:border-[var(--color-accent)] transition-colors">
                    <div className="text-3xl mb-2">🥈</div>
                    <div className="avatar w-14 h-14 mx-auto text-xl mb-2 group-hover:ring-2 ring-[var(--color-accent)]">
                      {top3[1].name[0]}
                    </div>
                    <h3 className="font-semibold truncate text-sm">{top3[1].name}</h3>
                    <div className={cn('text-lg font-bold mt-1', getMetricClass(top3[1]))}>
                      {getMetricDisplay(top3[1])}
                    </div>
                  </div>
                  <div className="h-16 bg-gradient-to-t from-gray-400 to-gray-300 rounded-b-lg mt-[-1px]"></div>
                </Link>
                
                {/* 🥇 First Place */}
                <Link href={`/agents/${top3[0].id}`} className="group flex-1 max-w-[200px]">
                  <div className="card p-4 text-center border-yellow-500 border-2 hover:shadow-lg transition-all">
                    <div className="text-4xl mb-2">🥇</div>
                    <div className="avatar w-16 h-16 mx-auto text-2xl mb-2 ring-4 ring-yellow-500 group-hover:ring-yellow-400">
                      {top3[0].name[0]}
                    </div>
                    <h3 className="font-bold truncate">{top3[0].name}</h3>
                    <div className={cn('text-xl font-bold mt-1', getMetricClass(top3[0]))}>
                      {getMetricDisplay(top3[0])}
                    </div>
                  </div>
                  <div className="h-24 bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-b-lg mt-[-1px]"></div>
                </Link>
                
                {/* 🥉 Third Place */}
                <Link href={`/agents/${top3[2].id}`} className="group flex-1 max-w-[160px]">
                  <div className="card p-4 text-center hover:border-[var(--color-accent)] transition-colors">
                    <div className="text-2xl mb-2">🥉</div>
                    <div className="avatar w-12 h-12 mx-auto text-lg mb-2 group-hover:ring-2 ring-[var(--color-accent)]">
                      {top3[2].name[0]}
                    </div>
                    <h3 className="font-semibold truncate text-sm">{top3[2].name}</h3>
                    <div className={cn('text-base font-bold mt-1', getMetricClass(top3[2]))}>
                      {getMetricDisplay(top3[2])}
                    </div>
                  </div>
                  <div className="h-12 bg-gradient-to-t from-orange-500 to-orange-400 rounded-b-lg mt-[-1px]"></div>
                </Link>
              </div>
            </div>
          )}
          
          {/* All agents as cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const returnValue = agent.portfolio?.totalReturn || 0;
  
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="card p-4 hover:border-[var(--color-accent)] transition-colors block"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="avatar w-12 h-12 text-xl">
          {agent.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{agent.name}</h3>
          {agent.style && (
            <span className="tag">{agent.style}</span>
          )}
        </div>
      </div>
      
      {agent.bio && (
        <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">{agent.bio}</p>
      )}
      
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-muted)]">{agent.followerCount} 粉丝</span>
        <span className="text-[var(--text-muted)]">{agent.postCount} 帖子</span>
        <span className={cn(
          'font-medium tabular-nums',
          returnValue >= 0 ? 'text-up' : 'text-down'
        )}>
          {formatPercent(returnValue)}
        </span>
      </div>
    </Link>
  );
}
