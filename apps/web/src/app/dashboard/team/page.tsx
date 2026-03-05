'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Users, UserPlus, Shield, Briefcase, X } from 'lucide-react';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: string;
  commissionRate: number;
  createdAt: string;
}

export default function TeamPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', commissionRate: '' });

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (error) {
      console.error(error);
      alert('無法載入團隊資料');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/users', {
        email: formData.email,
        password: formData.password,
        commissionRate: Number(formData.commissionRate) || 0,
      });
      setIsModalOpen(false);
      setFormData({ email: '', password: '', commissionRate: '' });
      await fetchUsers(); 
    } catch (error: any) {
      alert(error.response?.data?.message || '新增失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans pb-12 relative">
      
      {/* 新增員工 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <UserPlus size={20} className="text-blue-500" /> 新增業務成員
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">員工登入 Email</label>
                <input type="email" required placeholder="例如: sales@company.com" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">初始登入密碼 (至少6字元)</label>
                <input type="password" required placeholder="設定一組初始密碼" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">業績抽成比例 (%)</label>
                <input type="number" min="0" max="100" placeholder="例如: 10 代表 10%" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" value={formData.commissionRate} onChange={(e) => setFormData({...formData, commissionRate: e.target.value})} />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50">取消</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : '確認新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center sticky top-0 z-20 shadow-sm">
        <button onClick={() => router.push('/dashboard')} className="p-2 mr-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="bg-black dark:bg-white text-white dark:text-black p-1.5 rounded-lg shadow-md">
            <Users size={20} />
          </div>
          <h1 className="font-bold text-xl text-zinc-900 dark:text-white tracking-tight">
            團隊管理 <span className="text-sm font-normal text-zinc-500 ml-2">員工帳號與權限</span>
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        <div className="flex justify-end">
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center gap-2">
            <UserPlus size={18} /> 新增成員
          </button>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-6 py-4">帳號 (Email)</th>
                  <th className="px-6 py-4">角色權限</th>
                  <th className="px-6 py-4 text-center">抽成比例</th>
                  <th className="px-6 py-4">加入時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoading ? (
                  <tr><td colSpan={4} className="px-6 py-16 text-center text-zinc-500"><Loader2 className="animate-spin mx-auto mb-2" size={28} />載入資料中...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-16 text-center text-zinc-500">目前沒有團隊成員</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-5 font-medium text-zinc-900 dark:text-zinc-100">{user.email}</td>
                      <td className="px-6 py-5">
                        {user.role === 'BOSS' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 text-xs font-bold">
                            <Shield size={14} /> 管理者 (老闆)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 text-xs font-bold">
                            <Briefcase size={14} /> 業務員 (Sales)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center font-mono font-bold text-zinc-600 dark:text-zinc-400">
                        {Number(user.commissionRate)}%
                      </td>
                      <td className="px-6 py-5 text-sm text-zinc-500">
                        {new Date(user.createdAt).toLocaleDateString('zh-TW')}
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