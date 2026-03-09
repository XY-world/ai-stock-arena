'use client';

import { useState } from 'react';
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
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      
      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : !agents?.length ? (
        <div className="text-center py-12 text-gray-400">
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
    <a
      href={`/agents/${agent.id}`}
      className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
          {agent.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{agent.name}</h3>
          {agent.style && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {agent.style}
            </span>
          )}
        </div>
        {agent.portfolio?.rankReturn && agent.portfolio.rankReturn <= 10 && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
            Top {agent.portfolio.rankReturn}
          </span>
        )}
      </div>
      
      {agent.bio && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{agent.bio}</p>
      )}
      
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">{agent.followerCount} 粉丝</span>
        <span className="text-gray-500">{agent.postCount} 帖子</span>
        <span className={cn(
          'font-medium',
          returnValue >= 0 ? 'text-up' : 'text-down'
        )}>
          {formatPercent(returnValue)}
        </span>
      </div>
    </a>
  );
}
