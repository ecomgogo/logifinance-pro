'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface LogisticsProvider {
  id: string;
  code: string;
  name: string;
  type: string;
  isBuiltin: boolean;
  isActive: boolean;
}

interface FeeMapping {
  id: string;
  externalFeeCode: string;
  internalFeeCode: string;
  defaultArApType: 'AR' | 'AP';
}

interface RetryStats {
  queueLength: number;
  deadLetterLength: number;
  maxAttempts: number;
}

interface DeadLetterItem {
  id: string;
  source: 'LOGTT' | 'PROVIDER';
  providerCode: string;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
}

interface UserSettings {
  baseCurrency: string;
}

interface ExchangeRateRow {
  currency: string;
  manualRate: string | null;
  resolvedRate: string;
  source: 'base' | 'manual' | 'api' | 'api_fallback';
  apiRefreshedAt?: string | null;
  note?: string;
}

export default function AccountSettingsPage() {
  const [providers, setProviders] = useState<LogisticsProvider[]>([]);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderCode, setNewProviderCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [apiKeyCode, setApiKeyCode] = useState('LOGTT');
  const [appToken, setAppToken] = useState('');
  const [appKey, setAppKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mappingProviderCode, setMappingProviderCode] = useState('LOGTT');
  const [externalFeeCode, setExternalFeeCode] = useState('');
  const [internalFeeCode, setInternalFeeCode] = useState('');
  const [feeMappings, setFeeMappings] = useState<FeeMapping[]>([]);
  const [retryStats, setRetryStats] = useState<RetryStats>({
    queueLength: 0,
    deadLetterLength: 0,
    maxAttempts: 5,
  });
  const [deadLetters, setDeadLetters] = useState<DeadLetterItem[]>([]);
  const [isRetryProcessing, setIsRetryProcessing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [deadProviderFilter, setDeadProviderFilter] = useState('');
  const [deadSourceFilter, setDeadSourceFilter] = useState<
    '' | 'LOGTT' | 'PROVIDER'
  >('');
  const [batchLimit, setBatchLimit] = useState(20);
  const [baseCurrency, setBaseCurrency] = useState('HKD');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRateRow[]>([]);
  const [manualRateInputs, setManualRateInputs] = useState<Record<string, string>>({});
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);
  const hasApiFallbackRate = exchangeRates.some(
    (row) => row.source === 'api_fallback',
  );
  const latestApiRefreshTime = exchangeRates
    .map((row) => row.apiRefreshedAt || '')
    .filter(Boolean)
    .sort()
    .at(-1);

  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const loadProviders = async () => {
    const { data } = await api.get<LogisticsProvider[]>('/logistics-providers');
    setProviders(data);
  };

  useEffect(() => {
    const run = async () => {
      if (!token) {
        router.push('/login');
        return;
      }
      try {
        await api.post('/logistics-providers/bootstrap-fixed');
        await Promise.all([
          loadProviders(),
          loadFeeMappings('LOGTT'),
          loadRetryMonitor(),
          loadUserSettings(),
          loadExchangeRates(),
        ]);
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

  const createProvider = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/logistics-providers', {
      name: newProviderName,
      code: newProviderCode,
      type: 'CUSTOM',
    });
    setNewProviderName('');
    setNewProviderCode('');
    await loadProviders();
  };

  const saveApiSettings = async (e: FormEvent) => {
    e.preventDefault();
    await api.post(`/logistics-providers/${apiKeyCode}/credentials`, {
      appToken,
      appKey,
      webhookSecret,
    });
    alert('API 設置已儲存');
    await loadProviders();
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('新密碼與確認密碼不一致');
      return;
    }
    await api.patch('/users/password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    alert('密碼修改成功');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const loadFeeMappings = async (providerCode: string) => {
    const { data } = await api.get<FeeMapping[]>(
      `/logistics-providers/${providerCode}/fee-mappings`,
    );
    setFeeMappings(data);
  };

  const loadUserSettings = async () => {
    const { data } = await api.get<UserSettings>('/users/settings');
    setBaseCurrency(data?.baseCurrency === 'RMB' ? 'CNY' : data?.baseCurrency || 'HKD');
  };

  const saveUserSettings = async (e: FormEvent) => {
    e.preventDefault();
    await api.patch('/users/settings', { baseCurrency });
    alert('預設幣別已儲存');
    await loadExchangeRates();
  };

  const loadExchangeRates = async () => {
    const { data } = await api.get<{
      baseCurrency: string;
      rates: ExchangeRateRow[];
    }>('/users/settings/exchange-rates');
    applyExchangeRateData(data.rates);
  };

  const applyExchangeRateData = (rates: ExchangeRateRow[]) => {
    setExchangeRates(rates);
    const nextInputs: Record<string, string> = {};
    rates.forEach((row) => {
      nextInputs[row.currency] = row.manualRate ?? '';
    });
    setManualRateInputs(nextInputs);
  };

  const getRateSourceLabel = (source: ExchangeRateRow['source']) => {
    if (source === 'base') return '基準幣別(1)';
    if (source === 'manual') return '手寫匯率';
    if (source === 'api') return '匯率 API';
    return 'API 回退';
  };

  const saveExchangeRates = async (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, string | null> = {};
    Object.entries(manualRateInputs).forEach(([currency, value]) => {
      payload[currency] = value.trim() ? value.trim() : null;
    });
    await api.patch('/users/settings/exchange-rates', { rates: payload });
    alert('幣別匯率已儲存');
    await loadExchangeRates();
  };

  const refreshApiRates = async () => {
    setIsRefreshingRates(true);
    try {
      const before = [...exchangeRates];
      const { data } = await api.post<{
        baseCurrency: string;
        rates: ExchangeRateRow[];
      }>('/users/settings/exchange-rates/refresh-api');
      applyExchangeRateData(data.rates);

      const beforeMap = new Map(before.map((item) => [item.currency, item]));
      const changed = data.rates
        .filter((item) => {
          const oldItem = beforeMap.get(item.currency);
          if (!oldItem) return true;
          return (
            oldItem.resolvedRate !== item.resolvedRate ||
            oldItem.source !== item.source
          );
        })
        .map((item) => {
          const oldItem = beforeMap.get(item.currency);
          if (!oldItem) {
            return `${item.currency}: 新增 ${item.resolvedRate} (${getRateSourceLabel(item.source)})`;
          }
          return `${item.currency}: ${oldItem.resolvedRate}(${getRateSourceLabel(oldItem.source)}) → ${item.resolvedRate}(${getRateSourceLabel(item.source)})`;
        });

      if (changed.length === 0) {
        alert('已刷新 API 匯率，沒有偵測到變更。');
      } else {
        alert(`已刷新 API 匯率，變更如下：\n${changed.join('\n')}`);
      }
    } finally {
      setIsRefreshingRates(false);
    }
  };

  const upsertFeeMapping = async (e: FormEvent) => {
    e.preventDefault();
    await api.post(`/logistics-providers/${mappingProviderCode}/fee-mappings`, {
      externalFeeCode,
      internalFeeCode,
      defaultArApType: 'AP',
    });
    setExternalFeeCode('');
    setInternalFeeCode('');
    await loadFeeMappings(mappingProviderCode);
  };

  const loadRetryMonitor = async () => {
    const query = new URLSearchParams();
    if (deadProviderFilter) {
      query.set('providerCode', deadProviderFilter);
    }
    if (deadSourceFilter) {
      query.set('source', deadSourceFilter);
    }
    query.set('limit', '100');

    const [statsRes, deadRes] = await Promise.all([
      api.get<RetryStats>('/integration/webhook/retry/stats'),
      api.get<DeadLetterItem[]>(
        `/integration/webhook/retry/dead-letter?${query.toString()}`,
      ),
    ]);
    setRetryStats(statsRes.data);
    setDeadLetters(deadRes.data);
  };

  const processRetryQueue = async () => {
    setIsRetryProcessing(true);
    try {
      await api.post('/integration/webhook/retry/process');
      await loadRetryMonitor();
      alert('重試佇列處理完成');
    } finally {
      setIsRetryProcessing(false);
    }
  };

  const requeueDeadLetterJob = async (jobId: string) => {
    await api.post(`/integration/webhook/retry/dead-letter/${jobId}/requeue`);
    await loadRetryMonitor();
    alert('已重新加入重試佇列');
  };

  const requeueDeadLetterBatch = async () => {
    await api.post('/integration/webhook/retry/dead-letter/requeue-batch', {
      providerCode: deadProviderFilter || undefined,
      source: deadSourceFilter || undefined,
      limit: batchLimit,
    });
    await loadRetryMonitor();
    alert('批次重新入列完成');
  };

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const timer = window.setInterval(() => {
      loadRetryMonitor().catch(() => {
        // 避免自動刷新中斷 UI
      });
    }, 10000);

    return () => window.clearInterval(timer);
  }, [autoRefresh, deadProviderFilter, deadSourceFilter]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">帳戶設置</h1>
            <p className="text-sm text-zinc-500 mt-1">
              參考速遞管家：密碼修改、用戶中心、API 設置。
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm"
          >
            返回儀表板
          </button>
        </div>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold mb-3">公司預設幣別</h2>
          <form onSubmit={saveUserSettings} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
            >
              <option value="HKD">HKD</option>
              <option value="USD">USD</option>
              <option value="TWD">TWD</option>
              <option value="CNY">CNY</option>
            </select>
            <button className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black">
              儲存預設幣別
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold mb-3">幣別匯率設定（手寫優先）</h2>
          <p className="text-xs text-zinc-500 mb-3">
            基準幣別匯率固定為 1。其他幣別若有手寫匯率，系統優先使用；未填則自動使用免費匯率 API。
          </p>
          <div className="mb-3 text-xs text-zinc-500">
            最後刷新時間：{latestApiRefreshTime ? new Date(latestApiRefreshTime).toLocaleString('zh-TW') : '-'}
          </div>
          {hasApiFallbackRate && (
            <div className="mb-3 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs">
              部分幣別目前無法取得 API 匯率，系統已暫時回退為 1.00（建議先手動填寫）。
            </div>
          )}
          <form onSubmit={saveExchangeRates} className="space-y-3">
            {exchangeRates.map((row) => (
              <div key={row.currency} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  value={row.currency}
                  readOnly
                  className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-800/60"
                />
                <input
                  value={manualRateInputs[row.currency] ?? ''}
                  onChange={(e) =>
                    setManualRateInputs((prev) => ({
                      ...prev,
                      [row.currency]: e.target.value,
                    }))
                  }
                  disabled={row.source === 'base'}
                  placeholder={row.source === 'base' ? '基準幣別固定 1' : '留空則使用 API'}
                  className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent disabled:opacity-60"
                />
                <input
                  value={row.resolvedRate}
                  readOnly
                  className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-800/60"
                />
                <div className="flex items-center">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      row.source === 'base'
                        ? 'border-zinc-300 text-zinc-600 bg-zinc-100'
                        : row.source === 'manual'
                          ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                          : row.source === 'api'
                            ? 'border-blue-200 text-blue-700 bg-blue-50'
                            : 'border-amber-200 text-amber-700 bg-amber-50'
                    }`}
                  >
                    {getRateSourceLabel(row.source)}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black">
                儲存匯率設定
              </button>
              <button
                type="button"
                onClick={refreshApiRates}
                disabled={isRefreshingRates}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-60"
              >
                {isRefreshingRates ? '刷新中...' : '立即刷新 API 匯率'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold mb-3">密碼修改</h2>
          <form onSubmit={changePassword} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="舊密碼"
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="新密碼"
              required
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="確認新密碼"
              required
            />
            <button className="md:col-span-3 px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black">
              更新密碼
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold mb-3">用戶中心（物流供應商）</h2>
          <form onSubmit={createProvider} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={newProviderName}
              onChange={(e) => setNewProviderName(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="供應商名稱（例如 SF Express）"
              required
            />
            <input
              value={newProviderCode}
              onChange={(e) => setNewProviderCode(e.target.value.toUpperCase())}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="供應商代碼（例如 SF）"
              required
            />
            <button className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black">
              新增供應商
            </button>
          </form>

          <div className="mt-4 text-sm">
            {loading ? (
              <div>載入中...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {providers.map((p) => (
                  <span
                    key={p.id}
                    className="px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700"
                  >
                    {p.code} - {p.name}
                    {p.isBuiltin ? '（固定）' : '（自建）'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold mb-3">API 設置</h2>
          <form onSubmit={saveApiSettings} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={apiKeyCode}
              onChange={(e) => setApiKeyCode(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
            <input
              value={appToken}
              onChange={(e) => setAppToken(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="appToken"
            />
            <input
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="appKey"
            />
            <input
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="Webhook Secret（可選）"
            />
            <button className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black">
              儲存 API 設定
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold mb-3">費目映射（供應商費用代碼 -&gt; 內部費目）</h2>
          <form onSubmit={upsertFeeMapping} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={mappingProviderCode}
              onChange={async (e) => {
                const code = e.target.value;
                setMappingProviderCode(code);
                await loadFeeMappings(code);
              }}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.code}
                </option>
              ))}
            </select>
            <input
              value={externalFeeCode}
              onChange={(e) => setExternalFeeCode(e.target.value.toUpperCase())}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="外部費目代碼"
              required
            />
            <input
              value={internalFeeCode}
              onChange={(e) => setInternalFeeCode(e.target.value.toUpperCase())}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="內部費目代碼"
              required
            />
            <button className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black">
              儲存映射
            </button>
          </form>
          <div className="mt-4 text-sm space-y-2">
            {feeMappings.length === 0 ? (
              <div className="text-zinc-500">尚未設定映射</div>
            ) : (
              feeMappings.map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700"
                >
                  {item.externalFeeCode} → {item.internalFeeCode} ({item.defaultArApType})
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Webhook 監控（Retry / Dead Letter）</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setAutoRefresh((prev) => !prev)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  autoRefresh
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-zinc-300 dark:border-zinc-700'
                }`}
              >
                {autoRefresh ? '自動刷新：開' : '自動刷新：關'}
              </button>
              <button
                onClick={loadRetryMonitor}
                className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm"
              >
                重新整理
              </button>
              <button
                onClick={processRetryQueue}
                disabled={isRetryProcessing}
                className="px-3 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm disabled:opacity-60"
              >
                {isRetryProcessing ? '處理中...' : '一鍵重試'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <input
              value={deadProviderFilter}
              onChange={(e) => setDeadProviderFilter(e.target.value.toUpperCase())}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="Provider 篩選（例如 DHL）"
            />
            <select
              value={deadSourceFilter}
              onChange={(e) =>
                setDeadSourceFilter(e.target.value as '' | 'LOGTT' | 'PROVIDER')
              }
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
            >
              <option value="">全部來源</option>
              <option value="LOGTT">LOGTT</option>
              <option value="PROVIDER">PROVIDER</option>
            </select>
            <input
              type="number"
              min={1}
              max={200}
              value={batchLimit}
              onChange={(e) => setBatchLimit(Number(e.target.value) || 20)}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
              placeholder="批次數量"
            />
            <button
              onClick={requeueDeadLetterBatch}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm"
            >
              批次重新入列
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="px-3 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700">
              <div className="text-xs text-zinc-500">Retry Queue</div>
              <div className="text-2xl font-bold">{retryStats.queueLength}</div>
            </div>
            <div className="px-3 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700">
              <div className="text-xs text-zinc-500">Dead Letter</div>
              <div className="text-2xl font-bold">{retryStats.deadLetterLength}</div>
            </div>
            <div className="px-3 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700">
              <div className="text-xs text-zinc-500">Max Attempts</div>
              <div className="text-2xl font-bold">{retryStats.maxAttempts}</div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {deadLetters.length === 0 ? (
              <div className="text-zinc-500">目前沒有 dead-letter 記錄</div>
            ) : (
              deadLetters.map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700"
                >
                  <div className="font-medium">
                    {item.providerCode} / {item.source} / 嘗試次數 {item.attempts}
                    {' / '}
                    {item.maxAttempts}
                  </div>
                  <button
                    onClick={() => requeueDeadLetterJob(item.id)}
                    className="mt-2 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-xs"
                  >
                    單筆重新入列
                  </button>
                  {item.lastError && (
                    <div className="text-xs text-red-500 mt-1">{item.lastError}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
