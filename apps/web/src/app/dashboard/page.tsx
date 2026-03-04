// apps/web/src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ship, Plane, LogOut, Loader2, Package } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// 定義從後端回傳的運單型別
interface Shipment {
  id: string;
  internalNo: string;
  mblNumber: string | null;
  type: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  // 元件載入時，自動去後端抓取這家公司的所有運單
  useEffect(() => {
    const fetchShipments = async () => {
      try {
        const { data } = await api.get('/shipments');
        setShipments(data);
      } catch (error: any) {
        console.error('取得運單失敗', error);
        // 如果 Token 過期或無效，自動登出並導回登入頁
        if (error.response?.status === 401) {
          logout();
          router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchShipments();
  }, [logout, router]);

  // 登出邏輯
  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans">
      {/* 頂部導覽列 (Navbar) */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-black dark:bg-white text-white dark:text-black p-2 rounded-xl shadow-md">
            <Package size={20} />
          </div>
          <span className="font-bold text-xl text-zinc-900 dark:text-white tracking-tight">
            LogiFinance Pro
          </span>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
        >
          <LogOut size={18} />
          登出系統
        </button>
      </header>

      {/* 主要內容區 (Main Content) */}
      <main className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">業務單總覽</h1>
            <p className="text-zinc-500 dark:text-zinc-400">查看與管理您的所有海空運業務單與財務狀態。</p>
          </div>
          <button className="bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-md active:scale-95">
            + 新增運單
          </button>
        </div>

        {/* 數據表格卡片 (Data Table Card) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">內部單號</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">運輸類型</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">主單號 (MBL)</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">建立時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-zinc-500">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-zinc-400" size={28} />
                        <span className="font-medium">正在載入運單資料...</span>
                      </div>
                    </td>
                  </tr>
                ) : shipments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-zinc-500">
                      <div className="flex flex-col items-center gap-2">
                        <Package size={32} className="text-zinc-300 dark:text-zinc-700 mb-2" />
                        <p className="font-medium text-zinc-600 dark:text-zinc-400">目前沒有任何業務單</p>
                        <p className="text-sm">點擊右上角「新增運單」來建立您的第一筆業務</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  shipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{shipment.internalNo}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                          shipment.type === 'OCEAN' 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20' 
                            : 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20'
                        }`}>
                          {shipment.type === 'OCEAN' ? <Ship size={14} /> : <Plane size={14} />}
                          {shipment.type === 'OCEAN' ? '海運' : '空運'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-zinc-600 dark:text-zinc-300">
                        {shipment.mblNumber || '-'}
                      </td>
                      <td className="px-6 py-4 text-zinc-500 text-sm">
                        {new Date(shipment.createdAt).toLocaleDateString('zh-TW')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}