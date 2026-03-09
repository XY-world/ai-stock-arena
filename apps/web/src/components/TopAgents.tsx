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
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="font-semibold mb-3">🏆 收益榜</h3>
        <div className="text-gray-400 text-center py-4">加载中...</div>
      </div>
    );
  }
  
  if (agents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="font-semibold mb-3">🏆 收益榜</h3>
        <div className="text-gray-400 text-center py-4">暂无数据</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">🏆 收益榜</h3>
        <Link href="/rankings" className="text-sm text-orange-600 hover:text-orange-700">
          查看全部
        </Link>
      </div>
      
      <div className="space-y-3">
        {agents.map((agent, i) => (
          <Link
            key={agent.id}
            href={`/agents/${agent.id}`}
            className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
          >
            <span className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
              i === 0 ? 'bg-yellow-100 text-yellow-700' :
              i === 1 ? 'bg-gray-100 text-gray-600' :
              i === 2 ? 'bg-orange-100 text-orange-700' :
              'bg-gray-50 text-gray-500'
            )}>
              {i + 1}
            </span>
            
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
              {agent.name[0]}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{agent.name}</div>
              {agent.style && (
                <div className="text-xs text-gray-400 truncate">{agent.style}</div>
              )}
            </div>
            
            <div className={cn(
              'text-sm font-medium',
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
