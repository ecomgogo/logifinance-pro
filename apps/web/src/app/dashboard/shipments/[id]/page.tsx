'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
// 🌟 引入 Trash2 (垃圾桶) 圖示
import { ArrowLeft, Plus, TrendingUp, TrendingDown, DollarSign, Loader2, Building2, Receipt, CheckCircle2, CircleDashed, Banknote, Printer, Trash2 } from 'lucide-react';
import api from '@/lib/api';

interface Shipment {
  id: string;
  internalNo: string;
  mblNumber: string | null;
  type: string;
  currency?: string | null;
  receivableAmount?: string | null;
  payableAmount?: string | null;
}

interface UserSettings {
  baseCurrency: string;
}

interface Settlement {
  id: string;
  paidAmount: number;
  paymentDate: string;
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
  settlements: Settlement[];
}

export default function ShipmentDetailsPage() {
  const params = useParams();
  const shipmentId = params.id as string;
  const router = useRouter();

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [baseCurrency, setBaseCurrency] = useState('HKD');

  // 記帳 Modal 狀態
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chargeFormData, setChargeFormData] = useState({
    arApType: 'AR',
    feeCode: 'O/F',
    currency: 'HKD',
    amount: '',
    partnerName: ''
  });

  // 核銷 Modal 狀態
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlingCharge, setSettlingCharge] = useState<Charge | null>(null);
  const [settlementFormData, setSettlementFormData] = useState({
    paidAmount: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });

  const fetchData = useCallback(async () => {
    try {
      const [shipmentRes, chargesRes, settingsRes] = await Promise.all([
        api.get(`/shipments/${shipmentId}`),
        api.get(`/charges/shipment/${shipmentId}`),
        api.get<UserSettings>('/users/settings'),
      ]);
      setShipment(shipmentRes.data);
      setCharges(chargesRes.data);
      setBaseCurrency(settingsRes.data?.baseCurrency || 'HKD');
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

  // 處理新增費用
  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/charges', {
        shipmentId,
        arApType: chargeFormData.arApType,
        feeCode: chargeFormData.feeCode,
        currency: chargeFormData.currency,
        amount: chargeFormData.amount,
        partnerName: chargeFormData.partnerName,
      });

      if (shipment) {
        const targetAmountKey =
          chargeFormData.arApType === 'AR' ? 'receivableAmount' : 'payableAmount';
        const existingAmountRaw = shipment[targetAmountKey];
        const existingAmount = existingAmountRaw ? Number(existingAmountRaw) : null;
        const newAmount = Number(chargeFormData.amount);
        const willOverwriteAmount =
          existingAmount !== null &&
          Number.isFinite(existingAmount) &&
          existingAmount !== newAmount;
        const willOverwriteCurrency =
          !!shipment.currency && shipment.currency !== chargeFormData.currency;

        if (willOverwriteAmount || willOverwriteCurrency) {
          const confirmed = window.confirm(
            '偵測到本單已存在新增業務單資料。是否覆蓋原有數據？',
          );
          if (confirmed) {
            await api.patch(`/shipments/${shipmentId}/finance-fields`, {
              currency: chargeFormData.currency,
              ...(chargeFormData.arApType === 'AR'
                ? { receivableAmount: chargeFormData.amount }
                : { payableAmount: chargeFormData.amount }),
            });
          }
        }
      }

      setIsChargeModalOpen(false);
      setChargeFormData({ arApType: 'AR', feeCode: 'O/F', currency: 'HKD', amount: '', partnerName: '' });
      await fetchData(); 
    } catch (error: any) {
      alert(error.response?.data?.message || '新增費用失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🌟 新增：處理刪除費用
  const handleDeleteCharge = async (chargeId: string) => {
    const confirmDelete = window.confirm('確定要刪除這筆費用紀錄嗎？這項操作無法復原。');
    if (!confirmDelete) return;

    try {
      await api.delete(`/charges/${chargeId}`);
      await fetchData(); // 重新拉取資料，畫面自動更新
    } catch (error: any) {
      // 如果後端擋下來 (已經核銷)，會在這裡彈出警告
      alert(error.response?.data?.message || '刪除失敗，請稍後再試');
    }
  };

  // 處理核銷
  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingCharge) return;
    setIsSubmitting(true);
    try {
      await api.post('/settlements', {
        chargeId: settlingCharge.id,
        paidAmount: Number(settlementFormData.paidAmount),
        paymentDate: settlementFormData.paymentDate,
      });
      setIsSettlementModalOpen(false);
      await fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '核銷失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openSettlementModal = (charge: Charge, unpaidAmount: number) => {
    setSettlingCharge(charge);
    setSettlementFormData({
      paidAmount: unpaidAmount.toString(),
      paymentDate: new Date().toISOString().split('T')[0]
    });
    setIsSettlementModalOpen(true);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-black"><Loader2 className="animate-spin text-zinc-500" /></div>;
  if (!shipment) return null;

  const totalAR = charges
    .filter(c => c.arApType === 'AR')
    .reduce((sum, c) => sum + Number(c.baseAmount), 0);
  const totalAP = charges
    .filter(c => c.arApType === 'AP')
    .reduce((sum, c) => sum + Number(c.baseAmount), 0);
  const grossProfit = totalAR - totalAP;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans pb-12 relative">
      
      {/* 新增費用 Modal */}
      {isChargeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">記帳 (新增費用)</h2>
            </div>
            <form onSubmit={handleAddCharge} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 mb-2">
                <button type="button" onClick={() => setChargeFormData({...chargeFormData, arApType: 'AR'})} className={`py-2 rounded-lg border font-medium transition-all ${chargeFormData.arApType === 'AR' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400'}`}>
                  應收 (客戶)
                </button>
                <button type="button" onClick={() => setChargeFormData({...chargeFormData, arApType: 'AP'})} className={`py-2 rounded-lg border font-medium transition-all ${chargeFormData.arApType === 'AP' ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400'}`}>
                  應付 (成本)
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{chargeFormData.arApType === 'AR' ? '客戶名稱' : '供應商名稱'}</label>
                <input type="text" required placeholder="例如: Apple Inc." className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={chargeFormData.partnerName} onChange={(e) => setChargeFormData({...chargeFormData, partnerName: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">費用代碼</label>
                  <input type="text" required placeholder="例如: O/F" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={chargeFormData.feeCode} onChange={(e) => setChargeFormData({...chargeFormData, feeCode: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">幣別</label>
                  <select className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={chargeFormData.currency} onChange={(e) => setChargeFormData({...chargeFormData, currency: e.target.value})}>
                    <option value="HKD">HKD</option>
                    <option value="USD">USD</option>
                    <option value="CNY">CNY</option>
                    <option value="TWD">TWD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">金額</label>
                <input type="number" step="0.01" required placeholder="0.00" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white font-mono" value={chargeFormData.amount} onChange={(e) => setChargeFormData({...chargeFormData, amount: e.target.value})} />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsChargeModalOpen(false)} className="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">取消</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : '確認記帳'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 核銷 Modal */}
      {isSettlementModalOpen && settlingCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Banknote size={20} className="text-blue-500" /> 
                {settlingCharge.arApType === 'AR' ? '確認收款' : '確認付款'}
              </h2>
            </div>
            <form onSubmit={handleSettle} className="p-6 space-y-4">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 text-sm">
                <div className="flex justify-between text-zinc-500 mb-1">
                  <span>對象:</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{settlingCharge.partner.name}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>費用項目:</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{settlingCharge.feeCode}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">實際收付金額</label>
                <input type="number" step="0.01" required className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-lg font-bold" value={settlementFormData.paidAmount} onChange={(e) => setSettlementFormData({...settlementFormData, paidAmount: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">日期</label>
                <input type="date" required className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={settlementFormData.paymentDate} onChange={(e) => setSettlementFormData({...settlementFormData, paymentDate: e.target.value})} />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsSettlementModalOpen(false)} className="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">取消</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : '確認核銷'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 頁面標頭 */}
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

      <main className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">本單利潤分析</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => window.open(`/dashboard/shipments/${shipmentId}/invoice`, '_blank')}
              className="flex-1 sm:flex-none bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 px-4 py-2.5 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Printer size={16} /> 列印請款單
            </button>
            <button 
              onClick={() => {
                setChargeFormData((prev) => ({
                  ...prev,
                  currency: shipment.currency === 'RMB' ? 'CNY' : shipment.currency || 'HKD',
                }));
                setIsChargeModalOpen(true);
              }} 
              className="flex-1 sm:flex-none bg-black dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-sm"
            >
              <Plus size={16} /> 記一筆帳
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
              <TrendingUp size={18} /> <span className="text-sm font-medium">總應收 (AR)</span>
            </div>
            <h3 className="text-3xl font-bold text-zinc-900 dark:text-white font-mono">
              {totalAR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-2 text-sm text-zinc-500">{baseCurrency}</span>
            </h3>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-2">
              <TrendingDown size={18} /> <span className="text-sm font-medium">總應付 (AP)</span>
            </div>
            <h3 className="text-3xl font-bold text-zinc-900 dark:text-white font-mono">
              {totalAP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-2 text-sm text-zinc-500">{baseCurrency}</span>
            </h3>
          </div>
          <div className="bg-zinc-900 dark:bg-white p-6 rounded-2xl border border-zinc-800 dark:border-zinc-200 shadow-lg text-white dark:text-black">
            <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 mb-2">
              <DollarSign size={18} /> <span className="text-sm font-medium">預估毛利 (Profit)</span>
            </div>
            <h3 className="text-3xl font-bold font-mono">
              {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-2 text-sm text-zinc-400 dark:text-zinc-600">{baseCurrency}</span>
            </h3>
          </div>
        </div>

        {/* 費用列表 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 flex items-center gap-2">
             <Receipt size={18} className="text-zinc-500" />
             <h2 className="font-bold text-zinc-900 dark:text-white">收付明細與核銷狀態</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-6 py-4">類型</th>
                  <th className="px-6 py-4">對象</th>
                  <th className="px-6 py-4">代碼</th>
                  <th className="px-6 py-4 text-right">帳面金額</th>
                  <th className="px-6 py-4 text-right">已結清</th>
                  <th className="px-6 py-4 text-right">未結餘額</th>
                  <th className="px-6 py-4 text-center">狀態</th>
                  <th className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {charges.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">目前還沒有任何記帳紀錄</td>
                  </tr>
                ) : (
                  charges.map((charge) => {
                    const paidAmount = charge.settlements.reduce((sum, s) => sum + Number(s.paidAmount), 0);
                    const unpaidAmount = Number(charge.baseAmount) - paidAmount;
                    const isFullySettled = unpaidAmount <= 0;

                    return (
                      <tr key={charge.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold ${charge.arApType === 'AR' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                            {charge.arApType === 'AR' ? '應收' : '應付'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <Building2 size={14} className="text-zinc-400" /> {charge.partner.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">{charge.feeCode}</td>
                        <td className="px-6 py-4 text-right font-mono text-zinc-900 dark:text-zinc-100">{Number(charge.baseAmount).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-mono text-zinc-500">{paidAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">{unpaidAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          {isFullySettled ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                              <CheckCircle2 size={16} /> 已結清
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500 text-sm font-medium">
                              <CircleDashed size={16} /> 未結清
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          {!isFullySettled && (
                            <button 
                              onClick={() => openSettlementModal(charge, unpaidAmount)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-md text-sm font-medium transition-colors"
                            >
                              核銷
                            </button>
                          )}
                          
                          {/* 🌟 刪除按鈕 (只有在滑鼠移過去時才明顯顯示) */}
                          <button
                            onClick={() => handleDeleteCharge(charge.id)}
                            className="p-1.5 text-zinc-300 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                            title="刪除此筆費用"
                          >
                            <Trash2 size={16} />
                          </button>
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