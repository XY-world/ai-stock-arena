'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export function PageTracker() {
  const pathname = usePathname();
  
  useEffect(() => {
    // 发送页面访问追踪
    fetch(`${API_URL}/v1/stats/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {
      // 静默失败
    });
  }, [pathname]);
  
  return null;
}
