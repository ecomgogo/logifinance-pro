'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Ship, Plane, LogOut, Loader2, Package, TrendingUp, DollarSign, X, Users } from 'lucide-react';
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

export default function DashboardPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  // 🌟 新增：存放真實的營收與圖表數據
  const [stats, setStats] = useState({ totalRevenue: 0, chartData: [] });
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ internalNo: '', type: 'OCEAN', mblNumber: '' });

  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);

  const fetchData = useCallback(async () => {
    try {
      // 🌟 同時拉取運單列表與統計數據
      const [shipmentsRes, statsRes] = await Promise.all([
        api.get('/shipments'),
        api.get('/dashboard/stats')
      ]);
      setShipments(shipmentsRes.data);
      setStats(statsRes.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        logout();
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  }, [logout, router]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      router.push('/login');
      return;
    }
    fetchData();
  }, [fetchData, router, token]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/shipments', formData);
      setIsModalOpen(false);
      setFormData({ internalNo: '', type: 'OCEAN', mblNumber: '' });
      await fetchData(); 
    } catch (error: any) {
      alert(error.response?.data?.message || '建立失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalShipments = shipments.length;
  const oceanCount = shipments.filter(s => s.type === 'OCEAN').length;
  const airCount = shipments.filter(s => s.type === 'AIR').length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans pb-12 relative">
      
      {/* 新增運單 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">新增業務單</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateShipment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">內部單號 (必填)</label>
                <input type="text" required placeholder="例如: SHP-2026-002" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={formData.internalNo} onChange={(e) => setFormData({...formData, internalNo: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">運輸類型</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setFormData({...formData, type: 'OCEAN'})} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium ${formData.type === 'OCEAN' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 hover:bg-zinc-50'}`}>
                    <Ship size={18} /> 海運
                  </button>
                  <button type="button" onClick={() => setFormData({...formData, type: 'AIR'})} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium ${formData.type === 'AIR' ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-400' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 hover:bg-zinc-50'}`}>
                    <Plane size={18} /> 空運
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">主單號 MBL (選填)</label>
                <input type="text" placeholder="例如: OOCL-999888" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" value={formData.mblNumber} onChange={(e) => setFormData({...formData, mblNumber: e.target.value})} />
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
      )}

      {/* 頁首 */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="bg-black dark:bg-white text-white dark:text-black p-2 rounded-xl shadow-md"><Package size={20} /></div>
            <span className="font-bold text-xl text-zinc-900 dark:text-white tracking-tight">LogiFinance Pro</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <span className="text-sm font-bold text-zinc-900 dark:text-white border-b-2 border-black dark:border-white py-1">業務總覽</span>
            <button onClick={() => router.push('/dashboard/partners')} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white py-1 transition-colors flex items-center gap-1.5">
              <Users size={16} /> 對帳中心
            </button>
          </nav>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
          <LogOut size={18} /> 登出系統
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">營運儀表板</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">歡迎回來，這是您公司目前的即時營運狀況。</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard/partners')} className="md:hidden bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-lg font-medium shadow-sm flex items-center gap-2 text-sm">
              <Users size={16} /> 對帳中心
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-md active:scale-95">
              + 新增業務單
            </button>
          </div>
        </div>

        {/* 1. KPI 數據卡片區 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300"><Package size={20} /></div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">本月總運單數</p>
              <h3 className="text-3xl font-bold text-zinc-900 dark:text-white">{totalShipments > 0 ? totalShipments : '--'}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400"><Ship size={20} /></div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">海運單總數</p>
              <h3 className="text-3xl font-bold text-zinc-900 dark:text-white">{oceanCount} <span className="text-lg text-zinc-400 font-normal">單</span></h3>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-sky-50 dark:bg-sky-500/10 rounded-xl text-sky-600 dark:text-sky-400"><Plane size={20} /></div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">空運單總數</p>
              <h3 className="text-3xl font-bold text-zinc-900 dark:text-white">{airCount} <span className="text-lg text-zinc-400 font-normal">單</span></h3>
            </div>
          </div>
          <div className="bg-zinc-900 dark:bg-white p-6 rounded-2xl border border-zinc-800 dark:border-zinc-200 shadow-lg flex flex-col justify-between relative overflow-hidden hover:shadow-xl">
            <div className="absolute -right-6 -top-6 text-zinc-800 dark:text-zinc-100 opacity-50"><DollarSign size={100} /></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-3 bg-zinc-800 dark:bg-zinc-100 rounded-xl text-white dark:text-black"><DollarSign size={20} /></div>
            </div>
            <div className="relative z-10">
              {/* 🌟 替換為真實營收 */}
              <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 mb-1">累計總營收 (Base)</p>
              <h3 className="text-3xl font-bold text-white dark:text-black">{stats.totalRevenue.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        {/* 2. 互動式圖表區 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">近半年海空運單量趨勢 (真實數據)</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {/* 🌟 替換為真實圖表數據 */}
              <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
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
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">內部單號</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">運輸類型</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">主單號 (MBL)</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">建立時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoading ? (
                  <tr><td colSpan={4} className="px-6 py-16 text-center text-zinc-500"><Loader2 className="animate-spin mx-auto mb-2" size={28} />正在同步雲端資料...</td></tr>
                ) : shipments.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-16 text-center text-zinc-500">目前沒有任何業務單</td></tr>
                ) : (
                  shipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group bg-white dark:bg-zinc-900 cursor-pointer" onClick={() => router.push(`/dashboard/shipments/${shipment.id}`)}>
                      <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors">{shipment.internalNo}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${shipment.type === 'OCEAN' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-sky-100 text-sky-700 border-sky-200'}`}>
                          {shipment.type === 'OCEAN' ? <Ship size={14} /> : <Plane size={14} />} {shipment.type === 'OCEAN' ? '海運' : '空運'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-zinc-600 dark:text-zinc-300">{shipment.mblNumber || '-'}</td>
                      <td className="px-6 py-4 text-zinc-500 text-sm flex items-center justify-between">
                        {new Date(shipment.createdAt).toLocaleDateString('zh-TW')}
                        <span className="text-zinc-300 dark:text-zinc-700 group-hover:text-blue-500 transition-colors">→</span>
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