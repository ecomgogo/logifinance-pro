'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, TrendingUp, TrendingDown, DollarSign, Loader2, Building2, Receipt } from 'lucide-react';
import api from '@/lib/api';

interface Shipment {
  id: string;
  internalNo: string;
  mblNumber: string | null;
  type: string;
}

interface Charge {
  id: string;
  arApType: 'AR' | 'AP';
  feeCode: string;
  currency: string;
  amount: number;
  baseAmount: number;
  partner: { name: string };
  createdAt: string;
}

export default function ShipmentDetailsPage() {
  const params = useParams();
  const shipmentId = params.id as string;
  const router = useRouter();

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal 狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    arApType: 'AR',
    feeCode: 'O/F',
    currency: 'HKD',
    amount: '',
    partnerName: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const [shipmentRes, chargesRes] = await Promise.all([
        api.get(`/shipments/${shipmentId}`),
        api.get(`/charges/shipment/${shipmentId}`)
      ]);
      setShipment(shipmentRes.data);
      setCharges(chargesRes.data);
    } catch (error) {
      console.error(error);
      alert('載入資料失敗，請確認運單是否存在');
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [shipmentId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/charges', {
        shipmentId,
        arApType: formData.arApType,
        feeCode: formData.feeCode,
        currency: formData.currency,
        amount: Number(formData.amount),
        partnerName: formData.partnerName,
      });
      setIsModalOpen(false);
      setFormData({ arApType: 'AR', feeCode: 'O/F', currency: 'HKD', amount: '', partnerName: '' });
      await fetchData(); // 重新拉取計算最新毛利
    } catch (error: any) {
      alert(error.response?.data?.message || '新增費用失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-black"><Loader2 className="animate-spin text-zinc-500" /></div>;
  if (!shipment) return null;

  // 動態計算財務數據
  const totalAR = charges.filter(c => c.arApType === 'AR').reduce((sum, c) => sum + Number(c.baseAmount), 0);
  const totalAP = charges.filter(c => c.arApType === 'AP').reduce((sum, c) => sum + Number(c.baseAmount), 0);
  const grossProfit = totalAR - totalAP;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans pb-12 relative">
      
      {/* --- 新增費用 Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">記帳 (新增費用)</h2>
            </div>
            <form onSubmit={handleAddCharge} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 mb-2">
                <button type="button" onClick={() => setFormData({...formData, arApType: 'AR'})} className={`py-2 rounded-lg border font-medium transition-all ${formData.arApType === 'AR' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400'}`}>
                  應收 (客戶)
                </button>
                <button type="button" onClick={() => setFormData({...formData, arApType: 'AP'})} className={`py-2 rounded-lg border font-medium transition-all ${formData.arApType === 'AP' ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400'}`}>
                  應付 (成本)
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{formData.arApType === 'AR' ? '客戶名稱' : '供應商名稱'}</label>
                <input type="text" required placeholder="例如: Apple Inc." className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={formData.partnerName} onChange={(e) => setFormData({...formData, partnerName: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">費用代碼</label>
                  <input type="text" required placeholder="例如: O/F" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={formData.feeCode} onChange={(e) => setFormData({...formData, feeCode: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">幣別</label>
                  <select className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})}>
                    <option value="HKD">HKD</option>
                    <option value="USD">USD</option>
                    <option value="TWD">TWD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">金額</label>
                <input type="number" step="0.01" required placeholder="0.00" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white font-mono" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">取消</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : '確認記帳'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 頁面內容 --- */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center sticky top-0 z-20 shadow-sm">
        <button onClick={() => router.push('/dashboard')} className="p-2 mr-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-bold text-xl text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            單號 {shipment.internalNo}
            <span className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded font-normal">財務明細</span>
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 md:p-8 space-y-8">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">本單利潤分析</h2>
          <button onClick={() => setIsModalOpen(true)} className="bg-black dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-md active:scale-95 flex items-center gap-2 text-sm">
            <Plus size={16} /> 記一筆帳
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
              <TrendingUp size={18} /> <span className="text-sm font-medium">總應收 (AR)</span>
            </div>
            <h3 className="text-3xl font-bold text-zinc-900 dark:text-white font-mono">{totalAR.toLocaleString()}</h3>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-2">
              <TrendingDown size={18} /> <span className="text-sm font-medium">總應付 (AP)</span>
            </div>
            <h3 className="text-3xl font-bold text-zinc-900 dark:text-white font-mono">{totalAP.toLocaleString()}</h3>
          </div>
          <div className="bg-zinc-900 dark:bg-white p-6 rounded-2xl border border-zinc-800 dark:border-zinc-200 shadow-lg text-white dark:text-black">
            <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 mb-2">
              <DollarSign size={18} /> <span className="text-sm font-medium">預估毛利 (Profit)</span>
            </div>
            <h3 className="text-3xl font-bold font-mono">{grossProfit.toLocaleString()}</h3>
          </div>
        </div>

        {/* 費用列表 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 flex items-center gap-2">
             <Receipt size={18} className="text-zinc-500" />
             <h2 className="font-bold text-zinc-900 dark:text-white">費用明細帳</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-6 py-4">類型</th>
                  <th className="px-6 py-4">對象</th>
                  <th className="px-6 py-4">費用代碼</th>
                  <th className="px-6 py-4 text-right">金額 (本位幣)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {charges.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">目前還沒有任何記帳紀錄</td>
                  </tr>
                ) : (
                  charges.map((charge) => (
                    <tr key={charge.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold ${charge.arApType === 'AR' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                          {charge.arApType === 'AR' ? '應收' : '應付'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Building2 size={14} className="text-zinc-400" /> {charge.partner.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">{charge.feeCode}</td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {charge.arApType === 'AR' ? '+' : '-'}{Number(charge.baseAmount).toLocaleString()}
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