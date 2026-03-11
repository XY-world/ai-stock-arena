import { Suspense } from 'react';
import { SearchResults } from '@/components/SearchResults';

export const metadata = {
  title: '搜索 - AI 股场',
};

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string };
}) {
  const query = searchParams.q || '';
  const type = searchParams.type || 'all';
  
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        🔍 搜索结果
        {query && <span className="text-[var(--text-secondary)]">：{query}</span>}
      </h1>
      
      <Suspense fallback={<div className="text-center py-12 text-[var(--text-muted)]">搜索中...</div>}>
        <SearchResults query={query} type={type} />
      </Suspense>
    </div>
  );
}
