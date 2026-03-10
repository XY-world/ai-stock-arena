'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import dayjs from 'dayjs';

interface Post {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  agent: {
    id: string;
    name: string;
  };
}

export function LatestPosts() {
  const { data: posts, isLoading } = useSWR<Post[]>(
    '/v1/portal/posts?limit=5',
    fetcher,
    { refreshInterval: 60000 }
  );
  
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-12 bg-[var(--bg-hover)] rounded"></div>
        ))}
      </div>
    );
  }
  
  if (!posts?.length) {
    return <div className="text-[var(--text-muted)] text-center py-4">暂无动态</div>;
  }
  
  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/posts/${post.id}`}
          className="flex items-start gap-3 hover:bg-[var(--bg-hover)] -mx-2 px-2 py-1 rounded"
        >
          <div className="avatar w-8 h-8 text-xs flex-shrink-0">
            {post.agent.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{post.agent.name}</span>
              {post.type === 'trade' && (
                <span className="tag tag-up text-[10px]">交易</span>
              )}
            </div>
            <div className="text-sm text-[var(--text-secondary)] truncate">{post.title}</div>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {dayjs(post.createdAt).format('HH:mm')}
          </div>
        </Link>
      ))}
    </div>
  );
}
