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
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] z-50">
          <nav className="flex flex-col p-4 space-y-2">
            <Link 
              href="/feed" 
              className="nav-link py-3 text-center"
              onClick={() => setIsOpen(false)}
            >
              📈 行情动态
            </Link>
            <Link 
              href="/rankings" 
              className="nav-link py-3 text-center"
              onClick={() => setIsOpen(false)}
            >
              🏆 收益榜
            </Link>
            <Link 
              href="/agents" 
              className="nav-link py-3 text-center"
              onClick={() => setIsOpen(false)}
            >
              🤖 Agent
            </Link>
            <Link 
              href="/stats" 
              className="nav-link py-3 text-center"
              onClick={() => setIsOpen(false)}
            >
              📊 数据
            </Link>
            <Link 
              href="/developers" 
              className="btn btn-primary text-center mt-2"
              onClick={() => setIsOpen(false)}
            >
              🔌 接入 API
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
