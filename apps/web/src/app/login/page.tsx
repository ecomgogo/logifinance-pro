'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Mail, Lock, Coins, ArrowRight, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// 👇 這裡的 export default function 是 Next.js 抓取頁面的關鍵
export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    baseCurrency: 'HKD',
    email: '',
    password: '',
  });

  const router = useRouter();
  const setToken = useAuthStore((state) => state.setToken);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : formData;

      const { data } = await api.post(endpoint, payload);
      
      setToken(data.accessToken);
      router.push('/dashboard');
    } catch (error: any) {
      alert(error.response?.data?.message || '發生錯誤，請檢查資料或稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 text-center border-b border-zinc-100 dark:border-zinc-800">
          <div className="mx-auto bg-black dark:bg-white text-white dark:text-black w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <Building2 size={24} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            LogiFinance Pro
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isLogin ? '歡迎回來，請登入您的帳號' : '建立您的貨代財務管理空間'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">公司名稱</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                    placeholder="智匯國際物流"
                    value={formData.companyName}
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">系統本位幣</label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <select
                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all appearance-none"
                    value={formData.baseCurrency}
                    onChange={(e) => setFormData({...formData, baseCurrency: e.target.value})}
                  >
                    <option value="HKD">HKD (港幣)</option>
                    <option value="TWD">TWD (台幣)</option>
                    <option value="USD">USD (美金)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">電子郵件</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                placeholder="boss@example.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">密碼</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="password"
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 bg-black dark:bg-white text-white dark:text-black py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : (isLogin ? '登入系統' : '註冊帳號')}
            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 text-center">
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-zinc-500 hover:text-black dark:hover:text-white font-medium transition-colors"
          >
            {isLogin ? '還沒有公司帳號？點此註冊' : '已經有帳號了？返回登入'}
          </button>
        </div>
      </div>
    </div>
  );
}