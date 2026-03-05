'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // 元件一載入，立刻將使用者推往登入頁面
    router.push('/login');
  }, [router]);

  // 在跳轉的這 0.01 秒內，顯示一個優雅的載入轉圈圈，避免畫面全白
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-white"></div>
    </div>
  );
}