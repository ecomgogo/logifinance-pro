'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface Settlement {
  id: string;
  paidAmount: string;
  paymentDate: string;
}

interface ChargeItem {
  id: string;
  feeCode: string;
  arApType: 'AR' | 'AP';
  currency: string;
  amount: string;
  baseAmount: string;
  createdAt: string;
  settlements: Settlement[];
}

interface PartnerItem {
  id: string;
  name: string;
  type: 'Customer' | 'Vendor' | 'Agent';
  charges: ChargeItem[];
}

export default function FeeManagementPage() {
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      if (!token) {
        router.push('/login');
        return;
      }
      try {
        const { data } = await api.get<PartnerItem[]>('/partners');
        setPartners(data);
      } catch (error: any) {
        if (error.response?.status === 401) {
          logout();
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [logout, router, token]);

  const stats = useMemo(() => {
    const charges = partners.flatMap((partner) => partner.charges || []);
    const settlements = charges.flatMap((charge) => charge.settlements || []);
    const totalAR = charges
      .filter((c) => c.arApType === 'AR')
      .reduce((sum, c) => sum + Number(c.baseAmount || 0), 0);
    const totalAP = charges
      .filter((c) => c.arApType === 'AP')
      .reduce((sum, c) => sum + Number(c.baseAmount || 0), 0);
    const totalPaid = settlements.reduce(
      (sum, s) => sum + Number(s.paidAmount || 0),
      0,
    );

    return {
      chargeCount: charges.length,
      settlementCount: settlements.length,
      totalAR,
      totalAP,
      grossProfit: totalAR - totalAP,
      totalPaid,
    };
  }, [partners]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              費用管理
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              參考速遞管家流程：提交付款憑證、付款記錄、運費明細、成本統計、賬戶流水、賬單查詢。
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm"
          >
            返回儀表板
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="應收總額 (Base)" value={stats.totalAR.toFixed(2)} />
          <Card title="應付總額 (Base)" value={stats.totalAP.toFixed(2)} />
          <Card title="毛利 (Base)" value={stats.grossProfit.toFixed(2)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="運費明細筆數" value={String(stats.chargeCount)} />
          <Card title="付款記錄筆數" value={String(stats.settlementCount)} />
          <Card title="賬戶流水總額" value={stats.totalPaid.toFixed(2)} />
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
            運費明細 / 賬單查詢
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-950/40">
                <tr>
                  <th className="px-4 py-3 text-left">客戶/供應商</th>
                  <th className="px-4 py-3 text-left">類型</th>
                  <th className="px-4 py-3 text-left">費目代碼</th>
                  <th className="px-4 py-3 text-left">AR/AP</th>
                  <th className="px-4 py-3 text-left">金額</th>
                  <th className="px-4 py-3 text-left">建立時間</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-4" colSpan={6}>
                      載入中...
                    </td>
                  </tr>
                ) : partners.flatMap((partner) =>
                    (partner.charges || []).map((charge) => (
                      <tr
                        key={charge.id}
                        className="border-t border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="px-4 py-3">{partner.name}</td>
                        <td className="px-4 py-3">{partner.type}</td>
                        <td className="px-4 py-3">{charge.feeCode}</td>
                        <td className="px-4 py-3">{charge.arApType}</td>
                        <td className="px-4 py-3">
                          {charge.currency} {charge.amount}
                        </td>
                        <td className="px-4 py-3">
                          {new Date(charge.createdAt).toLocaleString('zh-TW')}
                        </td>
                      </tr>
                    )),
                  )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="text-sm text-zinc-500 dark:text-zinc-400">{title}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}
