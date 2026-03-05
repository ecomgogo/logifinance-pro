'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface Shipment {
  id: string;
  internalNo: string;
  referenceNo?: string | null;
  type: string;
  mblNumber?: string | null;
  shippingMethodCode?: string | null;
  currency?: string | null;
  receivableAmount?: string | null;
  payableAmount?: string | null;
  createdAt: string;
}

function getShipmentTypeLabel(type: string): string {
  if (type === 'COMMERCIAL_EXPRESS') return '商業快遞';
  if (type === 'POSTAL_SMALL_PARCEL') return '郵政小包';
  if (type === 'DEDICATED_LINE') return '專線產品';
  return type;
}

export default function ShipmentsListPage() {
  const router = useRouter();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const { data } = await api.get<Shipment[]>('/shipments');
      setShipments(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll().catch(() => {
      alert('載入業務單列表失敗');
      router.push('/dashboard');
    });
  }, [fetchAll, router]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-xl md:text-2xl font-bold">全部業務單</h1>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">內部單號</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">客戶單號</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">運輸類型</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">物流單號</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">渠道產品</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">幣別</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase text-right">建立時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-zinc-500">
                      <Loader2 className="animate-spin mx-auto mb-2" size={26} />
                      載入中...
                    </td>
                  </tr>
                ) : shipments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-zinc-500">
                      目前沒有資料
                    </td>
                  </tr>
                ) : (
                  shipments.map((shipment) => (
                    <tr
                      key={shipment.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                      onClick={() => router.push(`/dashboard/shipments/${shipment.id}`)}
                    >
                      <td className="px-6 py-4 font-semibold">{shipment.internalNo}</td>
                      <td className="px-6 py-4">{shipment.referenceNo || '-'}</td>
                      <td className="px-6 py-4">{getShipmentTypeLabel(shipment.type)}</td>
                      <td className="px-6 py-4 font-mono">{shipment.mblNumber || '-'}</td>
                      <td className="px-6 py-4">{shipment.shippingMethodCode || '-'}</td>
                      <td className="px-6 py-4">{shipment.currency || '-'}</td>
                      <td className="px-6 py-4 text-right text-zinc-500">
                        {new Date(shipment.createdAt).toLocaleString('zh-TW')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
