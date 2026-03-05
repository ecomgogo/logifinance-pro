'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2, Package, DollarSign, X, Users, Settings, Award, Download, Plus, Sparkles, UploadCloud, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { exportToCSV } from '@/lib/export'; 

interface Shipment {
  id: string;
  internalNo: string;
  mblNumber: string | null;
  type: string;
  shippingMethodCode?: string | null;
  currency?: string | null;
  receivableAmount?: string | null;
  payableAmount?: string | null;
  remark?: string | null;
  createdAt: string;
}

interface UserSettings {
  baseCurrency: string;
}

const PIE_COLORS = ['#2563eb', '#38bdf8', '#22c55e'];

function getShipmentTypeLabel(type: string): string {
  if (type === 'COMMERCIAL_EXPRESS') return '商業快遞';
  if (type === 'POSTAL_SMALL_PARCEL') return '郵政小包';
  if (type === 'DEDICATED_LINE') return '專線產品';
  return type;
}

function getShipmentTypeBadge(type: string): string {
  if (type === 'COMMERCIAL_EXPRESS') {
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }
  if (type === 'POSTAL_SMALL_PARCEL') {
    return 'bg-sky-100 text-sky-700 border-sky-200';
  }
  if (type === 'DEDICATED_LINE') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

function getChannelProductOptions(type: string): string[] {
  if (type === 'COMMERCIAL_EXPRESS') {
    return ['DHL', 'UPS', 'FEDEX', 'ARAMEX', 'TNT'];
  }
  if (type === 'POSTAL_SMALL_PARCEL') {
    return ['EMS', '郵政小包'];
  }
  if (type === 'DEDICATED_LINE') {
    return ['專線產品'];
  }
  return ['DHL', 'UPS', 'FEDEX', 'ARAMEX', 'TNT', 'EMS', '郵政小包', '專線產品'];
}

export default function DashboardPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState<{ totalRevenue: number; chartData: any[] }>({ totalRevenue: 0, chartData: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState('HKD');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingShipmentId, setEditingShipmentId] = useState('');
  const [formData, setFormData] = useState({
    internalNo: '',
    referenceNo: '',
    type: 'COMMERCIAL_EXPRESS',
    mblNumber: '',
    shippingMethodCode: 'DHL',
    currency: 'HKD',
    receivableAmount: '',
    payableAmount: '',
    remark: '',
  });
  const [editFormData, setEditFormData] = useState({
    type: 'COMMERCIAL_EXPRESS',
    mblNumber: '',
    shippingMethodCode: 'DHL',
  });

  // 🌟 AI 解析專用狀態與 Ref
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);

  const fetchData = useCallback(async () => {
    try {
      const [shipmentsRes, statsRes, settingsRes] = await Promise.all([
        api.get('/shipments'),
        api.get('/dashboard/stats'),
        api.get<UserSettings>('/users/settings'),
      ]);
      setShipments(shipmentsRes.data);
      setStats(statsRes.data);
      const preferredCurrency =
        settingsRes.data?.baseCurrency === 'RMB'
          ? 'CNY'
          : settingsRes.data?.baseCurrency || 'HKD';
      setDefaultCurrency(preferredCurrency);
      setFormData((prev) => ({
        ...prev,
        currency:
          prev.internalNo ||
          prev.referenceNo ||
          prev.mblNumber ||
          prev.receivableAmount ||
          prev.payableAmount ||
          prev.remark
            ? prev.currency
            : preferredCurrency,
      }));
    } catch (error: any) {
      if (error.response?.status === 401) { logout(); router.push('/login'); }
    } finally {
      setIsLoading(false);
    }
  }, [logout, router]);

  useEffect(() => { if (!token) { setIsLoading(false); router.push('/login'); return; } fetchData(); }, [fetchData, router, token]);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogout = () => { logout(); router.push('/login'); };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/shipments', formData);
      setIsModalOpen(false);
      setFormData({
        internalNo: '',
        referenceNo: '',
        type: 'COMMERCIAL_EXPRESS',
        mblNumber: '',
        shippingMethodCode: 'DHL',
        currency: defaultCurrency,
        receivableAmount: '',
        payableAmount: '',
        remark: '',
      });
      await fetchData(); 
    } catch (error: any) { alert(error.response?.data?.message || '建立失敗'); } finally { setIsSubmitting(false); }
  };

  // 🌟 核心：上傳文件並呼叫 AI 解析 API
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['csv', 'xls', 'xlsx', 'xlsm'];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!allowed.includes(ext)) {
      alert('僅支援上傳 Excel/CSV：csv、xls、xlsx、xlsm');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsParsing(true);
    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      // 呼叫 NestJS 的橋接 API，NestJS 會再去呼叫 Python
      const res = await api.post('/integration/parse-doc', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const firstRow = res.data?.parsed_rows?.[0];
      if (firstRow?.logistics_no || firstRow?.customer_order_no) {
        setFormData((prev) => ({
          ...prev,
          ...(firstRow.carrier &&
          getChannelProductOptions(prev.type).includes(
            String(firstRow.carrier).toUpperCase(),
          )
            ? { shippingMethodCode: String(firstRow.carrier).toUpperCase() }
            : {}),
          mblNumber: firstRow.logistics_no || prev.mblNumber,
          referenceNo: firstRow.customer_order_no || prev.referenceNo,
          currency: firstRow.currency || prev.currency,
          receivableAmount: firstRow.receivable || prev.receivableAmount,
          payableAmount: firstRow.payable || prev.payableAmount,
        }));
        alert(
          `🎉 解析成功！已填入客戶單號：${firstRow.customer_order_no || '-'}，物流單號：${firstRow.logistics_no || '-'}，應收：${firstRow.receivable || '-'}，應付：${firstRow.payable || '-'}`
        );
      } else {
        alert('解析完成，但未識別到可用的客戶單號或物流單號欄位。');
      }
    } catch (error) {
      alert('解析失敗，請確認檔案格式與 Python FastAPI 服務（Port 8000）狀態。');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // 重置 input
    }
  };

  const handleExport = () => {
    const exportData = shipments.map(s => ({
      '內部單號': s.internalNo,
      '運輸類型': getShipmentTypeLabel(s.type),
      '物流單號': s.mblNumber || '無',
      '幣種': s.currency || 'HKD',
      '應收金額': s.receivableAmount || '',
      '應付金額': s.payableAmount || '',
      '備註': s.remark || '',
      '建立時間': new Date(s.createdAt).toLocaleDateString('zh-TW'),
    }));
    exportToCSV(exportData, `業務單總表`);
  };

  const openEditShipmentModal = (shipment: Shipment) => {
    const options = getChannelProductOptions(shipment.type);
    setEditingShipmentId(shipment.id);
    setEditFormData({
      type: shipment.type,
      mblNumber: shipment.mblNumber || '',
      shippingMethodCode:
        shipment.shippingMethodCode && options.includes(shipment.shippingMethodCode)
          ? shipment.shippingMethodCode
          : options[0],
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.patch(`/shipments/${editingShipmentId}`, editFormData);
      setIsEditModalOpen(false);
      setEditingShipmentId('');
      await fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '修改業務單失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShipment = async (shipment: Shipment) => {
    const firstConfirm = window.confirm(
      `確定要刪除內部單號 ${shipment.internalNo} 嗎？`,
    );
    if (!firstConfirm) return;
    const secondConfirm = window.confirm(
      '再次確認：刪除後無法復原，是否繼續？',
    );
    if (!secondConfirm) return;

    try {
      await api.delete(`/shipments/${shipment.id}`);
      await fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '刪除失敗');
    }
  };

  const totalShipments = shipments.length;
  const commercialExpressCount = shipments.filter(
    (s) => s.type === 'COMMERCIAL_EXPRESS',
  ).length;
  const postalSmallParcelCount = shipments.filter(
    (s) => s.type === 'POSTAL_SMALL_PARCEL',
  ).length;
  const dedicatedLineCount = shipments.filter(
    (s) => s.type === 'DEDICATED_LINE',
  ).length;
  
  const pieData = [
    { name: '商業快遞', value: commercialExpressCount },
    { name: '郵政小包', value: postalSmallParcelCount },
    { name: '專線產品', value: dedicatedLineCount },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans pb-12 relative">
      
      {/* 新增業務單 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">新增業務單</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              {/* 🌟 AI 智能建單上傳區塊 */}
              <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-xl relative overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <h3 className="text-sm font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                      <Sparkles size={16} /> AI 智能解析建單
                    </h3>
                    <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">上傳 Excel/CSV，提取客戶單號、物流單號、應收應付與客戶資料</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef} 
                    accept=".csv,.xls,.xlsx,.xlsm"
                    onChange={handleFileUpload}
                  />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsing}
                    className="flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isParsing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {isParsing ? '解析中...' : '上傳文件'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateShipment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">內部單號（可選填）</label>
                  <input type="text" placeholder="可留空，自動生成 12 位數字" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white font-mono" value={formData.internalNo} onChange={(e) => setFormData({...formData, internalNo: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">客戶單號 Reference No（AI填寫）</label>
                  <input type="text" placeholder="例如: CUST-2026-001" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={formData.referenceNo} onChange={(e) => setFormData({...formData, referenceNo: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">運輸類型</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button type="button" onClick={() => setFormData((prev) => ({...prev, type: 'COMMERCIAL_EXPRESS', shippingMethodCode: getChannelProductOptions('COMMERCIAL_EXPRESS')[0]}))} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium ${formData.type === 'COMMERCIAL_EXPRESS' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 hover:bg-zinc-50'}`}>
                      商業快遞
                    </button>
                    <button type="button" onClick={() => setFormData((prev) => ({...prev, type: 'POSTAL_SMALL_PARCEL', shippingMethodCode: getChannelProductOptions('POSTAL_SMALL_PARCEL')[0]}))} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium ${formData.type === 'POSTAL_SMALL_PARCEL' ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 hover:bg-zinc-50'}`}>
                      郵政小包
                    </button>
                    <button type="button" onClick={() => setFormData((prev) => ({...prev, type: 'DEDICATED_LINE', shippingMethodCode: getChannelProductOptions('DEDICATED_LINE')[0]}))} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium ${formData.type === 'DEDICATED_LINE' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 hover:bg-zinc-50'}`}>
                      專線產品
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">物流單號（AI填寫）</label>
                  <input type="text" placeholder="例如: OOCL-999888" className="w-full px-4 py-2 bg-purple-50 dark:bg-purple-900/10 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono" value={formData.mblNumber} onChange={(e) => setFormData({...formData, mblNumber: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">幣種</label>
                    <select className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})}>
                      <option value="HKD">HKD</option>
                      <option value="USD">USD</option>
                      <option value="CNY">CNY</option>
                      <option value="TWD">TWD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">應收金額（AI填寫）</label>
                    <input type="number" step="0.0001" placeholder="0.0000" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={formData.receivableAmount} onChange={(e) => setFormData({...formData, receivableAmount: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">應付金額（AI填寫）</label>
                    <input type="number" step="0.0001" placeholder="0.0000" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={formData.payableAmount} onChange={(e) => setFormData({...formData, payableAmount: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">渠道產品</label>
                  <select
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    value={formData.shippingMethodCode}
                    onChange={(e) =>
                      setFormData({ ...formData, shippingMethodCode: e.target.value })
                    }
                  >
                    {getChannelProductOptions(formData.type).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">備註</label>
                  <textarea rows={3} placeholder="可填寫備註文字..." className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={formData.remark} onChange={(e) => setFormData({...formData, remark: e.target.value})} />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50">取消</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-zinc-800 disabled:opacity-50">
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : '確認建立'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">修改業務單</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateShipment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">運輸類型</label>
                <div className="grid grid-cols-3 gap-3">
                  <button type="button" onClick={() => setEditFormData((prev) => ({...prev, type: 'COMMERCIAL_EXPRESS', shippingMethodCode: getChannelProductOptions('COMMERCIAL_EXPRESS')[0]}))} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium ${editFormData.type === 'COMMERCIAL_EXPRESS' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 hover:bg-zinc-50'}`}>
                    商業快遞
                  </button>
                  <button type="button" onClick={() => setEditFormData((prev) => ({...prev, type: 'POSTAL_SMALL_PARCEL', shippingMethodCode: getChannelProductOptions('POSTAL_SMALL_PARCEL')[0]}))} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium ${editFormData.type === 'POSTAL_SMALL_PARCEL' ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 hover:bg-zinc-50'}`}>
                    郵政小包
                  </button>
                  <button type="button" onClick={() => setEditFormData((prev) => ({...prev, type: 'DEDICATED_LINE', shippingMethodCode: getChannelProductOptions('DEDICATED_LINE')[0]}))} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium ${editFormData.type === 'DEDICATED_LINE' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 hover:bg-zinc-50'}`}>
                    專線產品
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">物流單號</label>
                <input type="text" placeholder="例如: DHL-999888" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white font-mono" value={editFormData.mblNumber} onChange={(e) => setEditFormData({...editFormData, mblNumber: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">渠道產品</label>
                <select
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  value={editFormData.shippingMethodCode}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, shippingMethodCode: e.target.value })
                  }
                >
                  {getChannelProductOptions(editFormData.type).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-zinc-500">內部單號為系統識別碼，生成後不可修改。</div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50">取消</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-zinc-800 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : '確認修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 頁面標頭與導覽列 --- */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="bg-black dark:bg-white text-white dark:text-black p-2 rounded-xl shadow-md"><Package size={20} /></div>
            <span className="font-bold text-xl text-zinc-900 dark:text-white tracking-tight">LogiFinance Pro</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <span className="text-sm font-bold text-zinc-900 dark:text-white border-b-2 border-black dark:border-white py-1">業務總覽</span>
            <button onClick={() => router.push('/dashboard/partners')} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white py-1 flex items-center gap-1.5"><Users size={16} /> 對帳中心</button>
            <button onClick={() => router.push('/dashboard/team')} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white py-1 flex items-center gap-1.5"><Settings size={16} /> 團隊管理</button>
            <button onClick={() => router.push('/dashboard/commissions')} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white py-1 flex items-center gap-1.5"><Award size={16} /> 業績結算</button>
            <button onClick={() => router.push('/dashboard/fee-management')} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white py-1">費用管理</button>
            <button onClick={() => router.push('/dashboard/account-settings')} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white py-1">帳戶設置</button>
          </nav>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"><LogOut size={18} /> 登出</button>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">營運儀表板</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">歡迎回來，這是您公司目前的即時營運狀況。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleExport} className="bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-lg font-medium shadow-sm flex items-center gap-2 text-sm hover:bg-zinc-50 transition-colors"><Download size={16} /> 匯出報表</button>
            <button onClick={() => setIsModalOpen(true)} className="bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-lg font-medium shadow-md flex items-center gap-2 text-sm active:scale-95 transition-transform"><Plus size={16} /> 新增業務單</button>
          </div>
        </div>

        {/* KPI Cards... */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4"><div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300"><Package size={20} /></div></div>
            <div><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">本月總運單數</p><h3 className="text-3xl font-bold text-zinc-900 dark:text-white">{totalShipments > 0 ? totalShipments : '--'}</h3></div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4"><div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400"><Package size={20} /></div></div>
            <div><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">商業快遞單量</p><h3 className="text-3xl font-bold text-zinc-900 dark:text-white">{commercialExpressCount} <span className="text-lg text-zinc-400 font-normal">單</span></h3></div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4"><div className="p-3 bg-sky-50 dark:bg-sky-500/10 rounded-xl text-sky-600 dark:text-sky-400"><Package size={20} /></div></div>
            <div><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">郵政小包單量</p><h3 className="text-3xl font-bold text-zinc-900 dark:text-white">{postalSmallParcelCount} <span className="text-lg text-zinc-400 font-normal">單</span></h3></div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4"><div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400"><Package size={20} /></div></div>
            <div><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">專線產品單量</p><h3 className="text-3xl font-bold text-zinc-900 dark:text-white">{dedicatedLineCount} <span className="text-lg text-zinc-400 font-normal">單</span></h3></div>
          </div>
          <div className="bg-zinc-900 dark:bg-white p-6 rounded-2xl border border-zinc-800 dark:border-zinc-200 shadow-lg flex flex-col justify-between relative overflow-hidden hover:shadow-xl transition-shadow">
            <div className="absolute -right-6 -top-6 text-zinc-800 dark:text-zinc-100 opacity-50"><DollarSign size={100} /></div>
            <div className="flex justify-between items-start mb-4 relative z-10"><div className="p-3 bg-zinc-800 dark:bg-zinc-100 rounded-xl text-white dark:text-black"><DollarSign size={20} /></div></div>
            <div className="relative z-10"><p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 mb-1">累計總應收 ({defaultCurrency})</p><h3 className="text-3xl font-bold text-white dark:text-black">{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3></div>
          </div>
        </div>

        {/* 數據可視化區塊 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">近半年運輸類型單量趨勢</h2>
            <div className="h-[300px] w-full">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                  <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                    <Bar dataKey="commercialExpress" name="商業快遞" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="postalSmallParcel" name="郵政小包" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="dedicatedLine" name="專線產品" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full" />
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 flex flex-col">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">運輸類型佔比</h2>
            <div className="flex-1 min-h-[300px] w-full">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full" />
              )}
            </div>
          </div>
        </div>

        {/* 數據表格區 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">最新業務單</h2>
            <button onClick={() => router.push('/dashboard/shipments')} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">查看全部</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">內部單號</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">運輸類型</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">物流單號</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">渠道產品</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">建立時間</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-6 py-16 text-center text-zinc-500"><Loader2 className="animate-spin mx-auto mb-2" size={28} />正在同步雲端資料...</td></tr>
                ) : shipments.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-16 text-center text-zinc-500">目前沒有任何業務單</td></tr>
                ) : (
                  shipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group bg-white dark:bg-zinc-900 cursor-pointer" onClick={() => router.push(`/dashboard/shipments/${shipment.id}`)}>
                      <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors">{shipment.internalNo}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${getShipmentTypeBadge(shipment.type)}`}>
                          {getShipmentTypeLabel(shipment.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-zinc-600 dark:text-zinc-300">{shipment.mblNumber || '-'}</td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{shipment.shippingMethodCode || '-'}</td>
                      <td className="px-6 py-4 text-zinc-500 text-sm">
                        {new Date(shipment.createdAt).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditShipmentModal(shipment);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil size={13} />
                            修改
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteShipment(shipment);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={13} />
                            刪除
                          </button>
                        </div>
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