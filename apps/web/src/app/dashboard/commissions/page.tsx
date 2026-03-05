'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Award, DollarSign, Calculator, Lock } from 'lucide-react';
import api from '@/lib/api';

interface CommissionRecord {
  userId: string;
  email: string;
  commissionRate: number;
  shipmentCount: number;
  grossProfit: number;
  commission: number;
}

export default function CommissionsPage() {
  const router = useRouter();
  const [data, setData] = useState<{ period: string; commissions: CommissionRecord[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCommissions = useCallback(async () => {
    try {
      const res = await api.get('/users/commissions');
      setData(res.data);
    } catch (error: any) {
      if (error.response?.status === 403) {
        // 🌟 觸發後端的權限防護網
        alert('⛔ 存取拒絕：只有管理員 (BOSS) 可以查看業績與薪資結算。');
        router.push('/dashboard');
      } else {
        alert('無法載入結算資料');
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-black"><Loader2 className="animate-spin text-zinc-500" /></div>;
  if (!data) return null;

  const totalBonus = data.commissions.reduce((sum, c) => sum + c.commission, 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans pb-12">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center sticky top-0 z-20 shadow-sm">
        <button onClick={() => router.push('/dashboard')} className="p-2 mr-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="bg-black dark:bg-white text-white dark:text-black p-1.5 rounded-lg shadow-md">
            <Award size={20} />
          </div>
          <h1 className="font-bold text-xl text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            業績結算中心
            <span className="bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 text-xs px-2 py-0.5 rounded font-bold flex items-center gap-1">
              <Lock size={12} /> BOSS ONLY
            </span>
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 md:p-8 space-y-8">
        <div className="bg-zinc-900 dark:bg-white p-8 rounded-2xl shadow-xl text-white dark:text-black flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="text-zinc-400 dark:text-zinc-500 font-medium mb-1 flex items-center gap-2">
              <Calculator size={18} /> {data.period} 結算週期
            </h2>
            <p className="text-3xl font-bold">本月應發獎金總額</p>
          </div>
          <div className="text-5xl font-black font-mono text-emerald-400 dark:text-emerald-600 flex items-center">
            <DollarSign size={40} className="mr-1" />
            {totalBonus.toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-6 py-4">業務員 (Sales)</th>
                  <th className="px-6 py-4 text-center">本月開單數</th>
                  <th className="px-6 py-4 text-right">總毛利貢獻 (Profit)</th>
                  <th className="px-6 py-4 text-center">抽成比例</th>
                  <th className="px-6 py-4 text-right">應發獎金 (Commission)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.commissions.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center text-zinc-500">本月無業務數據</td></tr>
                ) : (
                  data.commissions.map((c) => (
                    <tr key={c.userId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-5 font-medium text-zinc-900 dark:text-zinc-100">{c.email}</td>
                      <td className="px-6 py-5 text-center font-mono text-zinc-600 dark:text-zinc-400">{c.shipmentCount} 單</td>
                      <td className="px-6 py-5 text-right font-mono text-zinc-900 dark:text-zinc-100">${c.grossProfit.toLocaleString()}</td>
                      <td className="px-6 py-5 text-center font-mono text-blue-600 dark:text-blue-400 font-bold">{c.commissionRate}%</td>
                      <td className="px-6 py-5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                        ${c.commission.toLocaleString()}
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