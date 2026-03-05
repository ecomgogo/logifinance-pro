const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_COUNT = 2;

export function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getProviderBaseUrl(providerCode: 'DHL' | 'FEDEX' | 'UPS'): string {
  if (providerCode === 'DHL') {
    return process.env.DHL_API_BASE_URL ?? 'https://express.api.dhl.com/mydhlapi';
  }
  if (providerCode === 'FEDEX') {
    return process.env.FEDEX_API_BASE_URL ?? 'https://apis.fedex.com';
  }
  return process.env.UPS_API_BASE_URL ?? 'https://onlinetools.ups.com';
}

export async function fetchWithRetry(
  input: string,
  init: RequestInit,
  options?: {
    timeoutMs?: number;
    retries?: number;
    retryLabel?: string;
  },
): Promise<Response> {
  const timeoutMs =
    options?.timeoutMs ?? getEnvNumber('PROVIDER_HTTP_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const retries =
    options?.retries ?? getEnvNumber('PROVIDER_HTTP_RETRY_COUNT', DEFAULT_RETRY_COUNT);
  const retryLabel = options?.retryLabel ?? 'provider-api';

  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const shouldRetry = response.status >= 500 || response.status === 429;
      if (!shouldRetry || attempt === retries) {
        return response;
      }
      const delayMs = 200 * 2 ** attempt;
      await sleep(delayMs);
      attempt += 1;
      continue;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt === retries) {
        throw new Error(
          `${retryLabel} 請求失敗，重試 ${retries + 1} 次後仍失敗：${String(error)}`,
        );
      }
      const delayMs = 200 * 2 ** attempt;
      await sleep(delayMs);
      attempt += 1;
    }
  }

  throw new Error(`${retryLabel} 請求失敗：${String(lastError)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
