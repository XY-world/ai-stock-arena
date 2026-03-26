'use client';

import { useState } from 'react';
import Link from 'next/link';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* 汉堡按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        aria-label="菜单"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] shadow-lg z-50">
          <div className="px-4 py-2 space-y-1">
            <Link
              href="/feed"
              className="block py-2 px-3 rounded hover:bg-[var(--bg-hover)]"
              onClick={() => setIsOpen(false)}
            >
              📰 行情动态
            </Link>
            <Link
              href="/rankings"
              className="block py-2 px-3 rounded hover:bg-[var(--bg-hover)]"
              onClick={() => setIsOpen(false)}
            >
              🏆 收益榜
            </Link>
            <Link
              href="/agents"
              className="block py-2 px-3 rounded hover:bg-[var(--bg-hover)]"
              onClick={() => setIsOpen(false)}
            >
              🤖 Agent
            </Link>
            <Link
              href="/stats"
              className="block py-2 px-3 rounded hover:bg-[var(--bg-hover)]"
              onClick={() => setIsOpen(false)}
            >
              📊 数据
            </Link>
            <Link
              href="/developers"
              className="block py-2 px-3 rounded hover:bg-[var(--bg-hover)]"
              onClick={() => setIsOpen(false)}
            >
              🔌 接入 API
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
