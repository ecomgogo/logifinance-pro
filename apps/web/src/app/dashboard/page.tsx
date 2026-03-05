'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Ship, Plane, LogOut, Loader2, Package, TrendingUp, DollarSign, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Shipment {
  id: string;
  internalNo: string;
  mblNumber: string | null;
  type: string;
  createdAt: string;
}

const mockChartData = [
  { month: '10月', ocean: 12, air: 8 },
  { month: '11月', ocean: 15, air: 10 },
  { month: '12月', ocean: 18, air: 12 },
  { month: '1月', ocean: 14, air: 15 },
  { month: '2月', ocean: 20, air: 18 },
  { month: '3月', ocean: 24, air: 22 },
];

export default function DashboardPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal 狀態管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    internalNo: '',
    type: 'OCEAN',
    mblNumber: ''
  });

  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);

  // 將拉取資料的邏輯獨立出來，方便新增完後重新呼叫
  const fetchShipments = useCallback(async () => {
    try {
      const { data } = await api.get('/shipments');
      setShipments(data);
    } catch (error: any) {
      console.error('取得運單失敗', error);
      if (error.response?.status === 401) {
        logout();
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  }, [logout, router]);

  useEffect(() => {
    // 未登入時不呼叫受保護 API，直接回登入頁避免 401 噪音
    if (!token) {
      setIsLoading(false);
      router.push('/login');
      return;
    }
    fetchShipments();
  }, [fetchShipments, router, token]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // 處理表單送出 (建立新運單)
  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 呼叫我們在 NestJS 寫好的 POST API
      await api.post('/shipments', formData);
      
      // 成功後關閉 Modal，清空表單，並重新拉取最新數據
      setIsModalOpen(false);
      setFormData({ internalNo: '', type: 'OCEAN', mblNumber: '' });
      await fetchShipments(); 
      
    } catch (error: any) {
      alert(error.response?.data?.message || '建立失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 動態計算 KPI
  const totalShipments = shipments.length;
  const oceanCount = shipments.filter(s => s.type === 'OCEAN').length;
  const airCount = shipments.filter(s => s.type === 'AIR').length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans pb-12 relative">
      
      {/* --- 新增運單 Modal 視窗 --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">新增業務單</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateShipment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">內部單號 (必填)</label>
                <input
                  type="text"
                  required
                  placeholder="例如: SHP-2026-002"
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  value={formData.internalNo}
                  onChange={(e) => setFormData({...formData, internalNo: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">運輸類型</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'OCEAN'})}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium transition-all ${formData.type === 'OCEAN' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 hover:bg-zinc-50'}`}
                  >
                    <Ship size={18} /> 海運
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'AIR'})}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium transition-all ${formData.type === 'AIR' ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 hover:bg-zinc-50'}`}
                  >
                    <Plane size={18} /> 空運
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">主單號 MBL (選填)</label>
                <input
                  type="text"
                  placeholder="例如: OOCL-999888"
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  value={formData.mblNumber}
                  onChange={(e) => setFormData({...formData, mblNumber: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : '確認建立'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- Modal 結束 --- */}


      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
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

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">營運儀表板</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">歡迎回來，這是您公司目前的即時營運狀況。</p>
          </div>
          
          {/* 👇 綁定開啟 Modal 的事件 */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-md active:scale-95"
          >
            + 新增業務單
          </button>
        </div>

        {/* 1. KPI 數據卡片區 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300">
                <Package size={20} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">本月總運單數</p>
              <h3 className="text-3xl font-bold text-zinc-900 dark:text-white">{totalShipments > 0 ? totalShipments : '--'}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                <Ship size={20} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">海運單總數</p>
              <h3 className="text-3xl font-bold text-zinc-900 dark:text-white">{oceanCount} <span className="text-lg text-zinc-400 font-normal">單</span></h3>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-sky-50 dark:bg-sky-500/10 rounded-xl text-sky-600 dark:text-sky-400">
                <Plane size={20} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">空運單總數</p>
              <h3 className="text-3xl font-bold text-zinc-900 dark:text-white">{airCount} <span className="text-lg text-zinc-400 font-normal">單</span></h3>
            </div>
          </div>

          <div className="bg-zinc-900 dark:bg-white p-6 rounded-2xl border border-zinc-800 dark:border-zinc-200 shadow-lg flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-xl">
            <div className="absolute -right-6 -top-6 text-zinc-800 dark:text-zinc-100 opacity-50">
              <DollarSign size={100} />
            </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-3 bg-zinc-800 dark:bg-zinc-100 rounded-xl text-white dark:text-black">
                <DollarSign size={20} />
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 mb-1">本月預估營收 (HKD)</p>
              <h3 className="text-3xl font-bold text-white dark:text-black">7,800</h3>
            </div>
          </div>
        </div>

        {/* 2. 互動式圖表區 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">近半年海空運單量趨勢</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                <Bar dataKey="ocean" name="海運 (Ocean)" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="air" name="空運 (Air)" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. 數據表格區 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">最新業務單</h2>
            <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">查看全部</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
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
                        <span className="font-medium">正在同步雲端資料...</span>
                      </div>
                    </td>
                  </tr>
                ) : shipments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-zinc-500">
                      <div className="flex flex-col items-center gap-2">
                        <Package size={32} className="text-zinc-300 dark:text-zinc-700 mb-2" />
                        <p className="font-medium text-zinc-600 dark:text-zinc-400">目前沒有任何業務單</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  shipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group bg-white dark:bg-zinc-900">
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