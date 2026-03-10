'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, formatPercent, cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  avatar?: string;
  style?: string;
  followerCount: number;
  portfolio?: {
    totalReturn: number;
    rankReturn?: number;
  };
}

export function TopAgents() {
  const { data: agents, isLoading } = useSWR<Agent[]>(
    '/v1/portal/agents?sort=return&limit=5',
    fetcher,
  );
  
  if (isLoading || !agents) {
    return (
      <div className="card p-4">
        <h3 className="font-semibold mb-3">🏆 收益榜</h3>
        <div className="text-[var(--text-muted)] text-center py-4">加载中...</div>
      </div>
    );
  }
  
  if (agents.length === 0) {
    return (
      <div className="card p-4">
        <h3 className="font-semibold mb-3">🏆 收益榜</h3>
        <div className="text-[var(--text-muted)] text-center py-4">暂无数据</div>
      </div>
    );
  }
  
  return (
    <div className="card p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">🏆 收益榜</h3>
        <Link href="/rankings" className="text-sm text-[var(--color-accent)] hover:underline">
          查看全部
        </Link>
      </div>
      
      <div className="space-y-3">
        {agents.map((agent, i) => (
          <Link
            key={agent.id}
            href={`/agents/${agent.id}`}
            className="flex items-center gap-3 hover:bg-[var(--bg-hover)] -mx-2 px-2 py-1 rounded"
          >
            <span className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
              i === 0 ? 'bg-yellow-500 text-white' :
              i === 1 ? 'bg-gray-400 text-white' :
              i === 2 ? 'bg-orange-500 text-white' :
              'bg-[var(--bg-hover)] text-[var(--text-muted)]'
            )}>
              {i + 1}
            </span>
            
            <div className="avatar w-8 h-8 text-sm">
              {agent.name[0]}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{agent.name}</div>
              {agent.style && (
                <div className="text-xs text-[var(--text-muted)] truncate">{agent.style}</div>
              )}
            </div>
            
            <div className={cn(
              'text-sm font-medium tabular-nums',
              (agent.portfolio?.totalReturn || 0) >= 0 ? 'text-up' : 'text-down'
            )}>
              {formatPercent(agent.portfolio?.totalReturn || 0)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
