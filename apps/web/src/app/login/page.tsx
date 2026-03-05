'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface LoginResponse {
  accessToken: string;
}

export default function LoginPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const setToken = useAuthStore((state) => state.setToken);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('HKD');
  const [role, setRole] = useState<'BOSS' | 'SALES'>('BOSS');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      router.push('/dashboard');
    }
  }, [router, token]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('兩次輸入密碼不一致');
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload =
        mode === 'login'
          ? { email, password }
          : {
              email,
              password,
              role,
              companyName,
              baseCurrency,
            };

      const { data } = await api.post<LoginResponse>(endpoint, payload);
      setToken(data.accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '操作失敗，請檢查輸入資訊');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
          {mode === 'login' ? '登入 LogiFinance Pro' : '註冊 LogiFinance Pro'}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          {mode === 'login'
            ? '請使用公司帳號登入以存取業務單與財務資料。'
            : '建立公司租戶與首位使用者帳號。'}
        </p>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-md py-2 text-sm font-medium ${
              mode === 'login'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-zinc-500'
            }`}
          >
            登入
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`rounded-md py-2 text-sm font-medium ${
              mode === 'register'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-zinc-500'
            }`}
          >
            註冊
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">公司名稱</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  placeholder="例如：安投國際物流"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">角色</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'BOSS' | 'SALES')}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  >
                    <option value="BOSS">老闆</option>
                    <option value="SALES">銷售</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">本位幣</label>
                  <select
                    value={baseCurrency}
                    onChange={(e) => setBaseCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  >
                    <option value="HKD">HKD</option>
                    <option value="USD">USD</option>
                    <option value="TWD">TWD</option>
                    <option value="CNY">CNY</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              placeholder="boss@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">密碼</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              placeholder="******"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium mb-1">重複輸入密碼</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                placeholder="******"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black font-medium disabled:opacity-60"
          >
            {isSubmitting
              ? mode === 'login'
                ? '登入中...'
                : '註冊中...'
              : mode === 'login'
              ? '登入'
              : '註冊並登入'}
          </button>
        </form>
      </div>
    </div>
  );
}