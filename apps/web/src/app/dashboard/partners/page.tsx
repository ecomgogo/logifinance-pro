'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
// 🌟 引入 Download 圖示
import { ArrowLeft, Loader2, Users, Building2, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import api from '@/lib/api';
// 🌟 引入匯出引擎
import { exportToCSV } from '@/lib/export';

interface Settlement {
  paidAmount: number;
}

interface Charge {
  arApType: 'AR' | 'AP';
  baseAmount: number;
  settlements: Settlement[];
}

interface Partner {
  id: string;
  name: string;
  type: string;
  charges: Charge[];
}

interface UserSettings {
  baseCurrency: string;
}

export default function PartnersPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [baseCurrency, setBaseCurrency] = useState('HKD');

  const fetchPartners = useCallback(async () => {
    try {
      const [partnersRes, settingsRes] = await Promise.all([
        api.get('/partners'),
        api.get<UserSettings>('/users/settings'),
      ]);
      setPartners(partnersRes.data);
      setBaseCurrency(settingsRes.data?.baseCurrency || 'HKD');
    } catch (error) {
      console.error(error);
      alert('無法載入對帳資料');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // 🌟 新增：匯出會計對帳單
  const handleExport = () => {
    const exportData = partners.map(p => {
      let totalAR = 0; let totalARPaid = 0;
      let totalAP = 0; let totalAPPaid = 0;

      p.charges.forEach(charge => {
        const amount = Number(charge.baseAmount);
        const paid = charge.settlements.reduce((sum, s) => sum + Number(s.paidAmount), 0);
        if (charge.arApType === 'AR') {
          totalAR += amount; totalARPaid += paid;
        } else {
          totalAP += amount; totalAPPaid += paid;
        }
      });

      return {
        '業務夥伴名稱': p.name,
        '夥伴類型': p.type === 'Customer' ? '客戶' : '供應商',
        '總應收 (AR)': totalAR,
        '應收未收 (客戶欠款)': totalAR - totalARPaid,
        '總應付 (AP)': totalAP,
        '應付未付 (我方欠款)': totalAP - totalAPPaid,
      };
    });

    const today = new Date().toISOString().split('T')[0];
    exportToCSV(exportData, `會計對帳總表_${today}`);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans pb-12">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-black dark:bg-white text-white dark:text-black p-1.5 rounded-lg shadow-md">
              <Users size={20} />
            </div>
            <h1 className="font-bold text-xl text-zinc-900 dark:text-white tracking-tight">
              對帳中心 <span className="text-sm font-normal text-zinc-500 ml-2">客戶與供應商總帳</span>
            </h1>
          </div>
        </div>
        
        {/* 🌟 匯出按鈕 */}
        <button onClick={handleExport} className="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 px-4 py-2.5 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all flex items-center gap-2 text-sm">
          <Download size={16} /> 匯出會計對帳單
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-6 py-4">業務夥伴名稱</th>
                  <th className="px-6 py-4 text-right">總應收 (AR)</th>
                  <th className="px-6 py-4 text-right">應收未收 (欠款)</th>
                  <th className="px-6 py-4 text-right">總應付 (AP)</th>
                  <th className="px-6 py-4 text-right">應付未付 (欠款)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-zinc-500">
                      <Loader2 className="animate-spin mx-auto mb-2" size={28} />
                      載入帳務資料中...
                    </td>
                  </tr>
                ) : partners.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-zinc-500">目前還沒有任何業務夥伴紀錄</td>
                  </tr>
                ) : (
                  partners.map((partner) => {
                    let totalAR = 0; let totalARPaid = 0;
                    let totalAP = 0; let totalAPPaid = 0;

                    partner.charges.forEach(charge => {
                      const amount = Number(charge.baseAmount);
                      const paid = charge.settlements.reduce((sum, s) => sum + Number(s.paidAmount), 0);
                      if (charge.arApType === 'AR') {
                        totalAR += amount; totalARPaid += paid;
                      } else {
                        totalAP += amount; totalAPPaid += paid;
                      }
                    });

                    const unpaidAR = totalAR - totalARPaid;
                    const unpaidAP = totalAP - totalAPPaid;

                    return (
                      <tr key={partner.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-5 font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                          <Building2 size={18} className="text-zinc-400" />
                          <span className="text-base">{partner.name}</span>
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-zinc-600 dark:text-zinc-400">
                          {totalAR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="ml-1 text-xs text-zinc-400">{baseCurrency}</span>
                        </td>
                        <td className="px-6 py-5 text-right font-mono font-bold">
                          {unpaidAR > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center justify-end gap-1"><AlertCircle size={14}/> {unpaidAR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-xs text-zinc-400">{baseCurrency}</span></span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1"><CheckCircle2 size={14}/> 0</span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-zinc-600 dark:text-zinc-400">
                          {totalAP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="ml-1 text-xs text-zinc-400">{baseCurrency}</span>
                        </td>
                        <td className="px-6 py-5 text-right font-mono font-bold">
                          {unpaidAP > 0 ? (
                            <span className="text-amber-600 dark:text-amber-500 flex items-center justify-end gap-1"><AlertCircle size={14}/> {unpaidAP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-xs text-zinc-400">{baseCurrency}</span></span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1"><CheckCircle2 size={14}/> 0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}