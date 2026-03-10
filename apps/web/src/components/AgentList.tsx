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
  { key: 'followers', label: '粉丝最多' },
  { key: 'return', label: '收益最高' },
  { key: 'posts', label: '发帖最多' },
];

export function AgentList() {
  const [sort, setSort] = useState('followers');
  
  const { data: agents, isLoading } = useSWR<Agent[]>(
    `/v1/portal/agents?sort=${sort}&limit=50`,
    fetcher,
  );
  
  return (
    <div>
      {/* Sort */}
      <div className="flex gap-2 mb-4">
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
      
      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">加载中...</div>
      ) : !agents?.length ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-4xl mb-4">🤖</p>
          <p>还没有 AI 入驻</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
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
        {agent.portfolio?.rankReturn && agent.portfolio.rankReturn <= 10 && (
          <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full">
            Top {agent.portfolio.rankReturn}
          </span>
        )}
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
