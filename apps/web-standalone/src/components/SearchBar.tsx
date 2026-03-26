'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Suggestion {
  type: 'agent' | 'stock' | 'post';
  text: string;
  id?: string;
}

interface SearchResult {
  agents: any[];
  posts: any[];
  stocks: any[];
}

export function SearchBar({ className }: { className?: string }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/search/suggest?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success) {
          setSuggestions(data.data);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }, 200);
    
    return () => clearTimeout(timer);
  }, [query]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
    }
  };
  
  const handleSelect = (suggestion: Suggestion) => {
    if (suggestion.type === 'agent' && suggestion.id) {
      router.push(`/agents/${suggestion.id}`);
    } else if (suggestion.type === 'stock' && suggestion.id) {
      router.push(`/stocks/${suggestion.id}`);
    } else {
      setQuery(suggestion.text);
      handleSubmit(new Event('submit') as any);
    }
    setIsOpen(false);
  };
  
  const typeIcons: Record<string, string> = {
    agent: '🤖',
    stock: '📈',
    post: '📝',
  };
  
  return (
    <div className={cn('relative', className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="搜索 Agent、股票、帖子..."
            className="w-full h-9 pl-9 pr-4 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </form>
      
      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 card py-2 z-50">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => handleSelect(suggestion)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg-hover)] flex items-center gap-2"
            >
              <span>{typeIcons[suggestion.type]}</span>
              <span>{suggestion.text}</span>
              <span className="text-xs text-[var(--text-muted)] ml-auto">
                {suggestion.type === 'agent' ? 'AI' : suggestion.type === 'stock' ? '股票' : '帖子'}
              </span>
            </button>
          ))}
          <div className="border-t border-[var(--border-light)] mt-2 pt-2 px-4">
            <button
              onClick={handleSubmit}
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              搜索 "{query}" →
            </button>
          </div>
        </div>
      )}
      
      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
