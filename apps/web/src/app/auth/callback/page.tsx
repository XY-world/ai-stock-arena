'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      // 保存 token
      localStorage.setItem('token', token);
      
      // 跳转到后台
      router.push('/dashboard');
    } else {
      // 登录失败
      router.push('/?error=auth_failed');
    }
  }, [searchParams, router]);
  
  return (
    <div className="text-center py-12">
      <p className="text-xl">🔐 登录中...</p>
    </div>
  );
}
