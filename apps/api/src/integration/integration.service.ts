import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, createHmac } from 'crypto';
import {
  LogisticsWebhookHeadersDto,
  UpsertLogttCredentialDto,
} from './integration.dto';
import { ChargeService } from '../charge/charge.service';
import { LogisticsProviderService } from '../logistics-provider/logistics-provider.service';
import { DhlClient } from './providers/dhl.client';
import { FedexClient } from './providers/fedex.client';
import { UpsClient } from './providers/ups.client';

interface UploadedFilePayload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

export interface WebhookRetryJob {
  id: string;
  source: 'LOGTT' | 'PROVIDER';
  tenantId: string;
  providerCode: string;
  payload: unknown;
  rawBody: string;
  headers?: LogisticsWebhookHeadersDto;
  signature?: string;
  timestamp?: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  lastError?: string;
}

interface DeadLetterFilter {
  providerCode?: string;
  source?: 'LOGTT' | 'PROVIDER';
}

const WEBHOOK_RETRY_QUEUE_KEY = 'queue:webhook:retry';
const WEBHOOK_DEADLETTER_QUEUE_KEY = 'queue:webhook:deadletter';
const RETRY_MAX_ATTEMPTS = 5;

@Injectable()
export class IntegrationService {
  constructor(
    private readonly redisService: RedisService,
    private readonly clsService: ClsService,
    private readonly prisma: PrismaService,
    private readonly chargeService: ChargeService,
    private readonly logisticsProviderService: LogisticsProviderService,
    private readonly dhlClient: DhlClient,
    private readonly fedexClient: FedexClient,
    private readonly upsClient: UpsClient,
  ) {}

  /**
   * 取得當前租戶 ID。若無租戶上下文（例如系統任務）則回傳 system。
   */
  private getTenantId(): string {
    const tenantId = this.clsService.get<string>('tenant_id');
    if (typeof tenantId === 'string' && tenantId.length > 0) {
      return tenantId;
    }
    throw new UnauthorizedException('缺少租戶上下文，請先登入或提供合法租戶資訊');
  }

  // =================================================================
  // 🔗 第三方物流 API 整合 (模擬速遞管家、易倉)
  // =================================================================

  /**
   * 取得外部 API Token。
   * 👉 實作細節：Token 有效期通常為 2 小時，我們快取 7000 秒 (略少於 2 小時)，
   * 避免每次查物流都去要 Token 導致被鎖 API。
   */
  private async getLogisticsApiToken(): Promise<string> {
    const tenantId = this.getTenantId();
    const cacheKey = `${tenantId}:ext_api:logistics:token`;
    let token = await this.redisService.get(cacheKey);
    const credential = await this.getActiveLogttCredential();

    if (!token) {
      console.log('🔄 Token 已過期或不存在，向第三方物流系統重新請求 Token...');
      // 這裡模擬向第三方 API 發送 HTTP 請求獲取 Token
      // const res = await fetch('https://api.ecang.com/auth/token', { ... });
      token = `mock_token_${credential.appToken}_${Date.now()}`;
      
      // 將取得的 Token 存入 Redis，設定 7000 秒後過期
      await this.redisService.set(cacheKey, token, 7000);
    }
    
    return token;
  }

  /**
   * 查詢物流軌跡
   */
  async getTrackingInfo(trackingNumber: string) {
    const token = await this.getLogisticsApiToken();
    
    console.log(`📦 使用 Token [${token}] 查詢單號: ${trackingNumber}`);
    // 這裡模擬向第三方系統請求軌跡
    // const res = await fetch(`https://api.ecang.com/tracking?no=${trackingNumber}`, { headers: { Authorization: `Bearer ${token}` }})

    return {
      trackingNumber,
      status: 'IN_TRANSIT',
      location: 'Hong Kong Logistics Hub',
      updatedAt: new Date().toISOString(),
    };
  }

  async getProviderTrackingInfo(providerCode: string, trackingNumber: string) {
    const normalizedCode = providerCode.trim().toUpperCase();

    if (normalizedCode === 'LOGTT') {
      return this.getTrackingInfo(trackingNumber);
    }

    const clients = [this.dhlClient, this.fedexClient, this.upsClient];
    const client = clients.find((item) => item.providerCode === normalizedCode);
    if (!client) {
      throw new BadRequestException(`尚未支援的物流供應商：${normalizedCode}`);
    }

    return client.getTracking(trackingNumber);
  }

  // =================================================================
  // 💰 每日匯率快取整合
  // =================================================================

  /**
   * 取得即時匯率。
   * 👉 實作細節：高頻查詢，每天只需更新一次。快取 24 小時 (86400 秒)。
   */
  async getExchangeRate(currency: string): Promise<number> {
    const tenantId = this.getTenantId();
    const cacheKey = `${tenantId}:ext_api:exchange_rate:${currency.toUpperCase()}`;
    let rateStr = await this.redisService.get(cacheKey);

    if (!rateStr) {
      console.log(`🔄 Redis 無匯率快取，向外部匯率 API 請求 ${currency} 最新匯率...`);
      
      // 模擬呼叫外部匯率 API (如 Fixer.io, ExchangeRate-API)
      const mockRates: Record<string, number> = { USD: 7.8, TWD: 0.25, EUR: 8.5 };
      const rate = mockRates[currency.toUpperCase()] || 1;

      // 存入 Redis，快取 24 小時
      await this.redisService.set(cacheKey, rate.toString(), 86400);
      return rate;
    }

    return parseFloat(rateStr);
  }

  /**
   * 呼叫 Python 解析服務，並在 Header 帶入 X-Tenant-ID 以確保多租戶隔離。
   */
  async parseDocument(file: UploadedFilePayload) {
    this.validateSpreadsheetFile(file);
    const tenantId = this.getTenantId();
    const formData = new FormData();
    const binary = Uint8Array.from(file.buffer);
    const blob = new Blob([binary], { type: file.mimetype });
    formData.append('file', blob, file.originalname);

    try {
      const response = await fetch('http://127.0.0.1:8000/parse', {
        method: 'POST',
        headers: {
          'X-Tenant-ID': tenantId,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new InternalServerErrorException(
          `Python 解析服務回傳錯誤：${response.status}`,
        );
      }

      return await response.json();
    } catch {
      throw new InternalServerErrorException(
        '無法連線至 Python 解析服務，請確認 FastAPI 是否啟動在 Port 8000',
      );
    }
  }

  async upsertLogttCredential(dto: UpsertLogttCredentialDto) {
    const tenantId = this.getTenantId();

    return this.prisma.client.tenantApiCredential.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'LOGTT',
        },
      },
      update: {
        appToken: dto.appToken,
        appKey: dto.appKey,
        isActive: true,
      },
      create: {
        tenantId,
        provider: 'LOGTT',
        appToken: dto.appToken,
        appKey: dto.appKey,
        isActive: true,
      },
    });
  }

  async handleLogisticsWebhook(params: {
    headers: LogisticsWebhookHeadersDto;
    payload: unknown;
    rawBody: string;
  }) {
    const tenantId = this.getTenantId();
    const { headers, payload, rawBody } = params;

    const isAllowed = await this.redisService.checkRateLimit(
      `ratelimit:webhook:${tenantId}`,
      60,
      60,
    );
    if (!isAllowed) {
      throw new BadRequestException('Webhook 請求過於頻繁');
    }

    const dedupeKey = `${tenantId}:webhook:logtt:${headers.sign}:${headers.timestamp}`;
    const isDuplicated = await this.redisService.get(dedupeKey);
    if (isDuplicated) {
      return { status: 'duplicate', message: 'Webhook already processed' };
    }

    await this.verifyLogttSignature({
      datatype: headers.datatype,
      sign: headers.sign,
      timestamp: headers.timestamp,
      rawBody,
    });

    if (headers.datatype === 'fee') {
      const result = await this.handleFeeWebhook(payload, 'LOGTT', 'LOGTT');
      await this.redisService.set(dedupeKey, '1', 3600);
      return result;
    }

    await this.redisService.set(dedupeKey, '1', 3600);
    return {
      status: 'accepted',
      datatype: headers.datatype,
      message: 'Webhook 已驗簽並接收',
    };
  }

  async handleProviderFeeWebhook(params: {
    providerCode: string;
    payload: unknown;
    rawBody: string;
    signature?: string;
    timestamp?: string;
  }) {
    const tenantId = this.getTenantId();
    const providerCode = params.providerCode.trim().toUpperCase();
    const provider = await this.prisma.client.logisticsProvider.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: providerCode,
        },
      },
      select: {
        code: true,
        name: true,
        webhookSecret: true,
      },
    });

    if (!provider) {
      throw new BadRequestException(`找不到供應商代碼：${providerCode}`);
    }

    if (provider.webhookSecret) {
      if (!params.timestamp || !params.signature) {
        throw new UnauthorizedException('缺少簽名驗證 Header');
      }
      const now = Date.now();
      const reqTimestamp = Number(params.timestamp);
      if (
        !Number.isFinite(reqTimestamp) ||
        Math.abs(now - reqTimestamp) > 5 * 60 * 1000
      ) {
        throw new UnauthorizedException('Webhook timestamp 無效或已過期');
      }

      const expected = createHmac('sha256', provider.webhookSecret)
        .update(`${params.rawBody}.${params.timestamp}`)
        .digest('hex');
      if (expected.toLowerCase() !== params.signature.toLowerCase()) {
        throw new UnauthorizedException('Provider Webhook 簽名驗證失敗');
      }
    }

    const dedupeKey = `${tenantId}:webhook:provider:${providerCode}:${createHash('sha1')
      .update(params.rawBody)
      .digest('hex')}`;
    const duplicated = await this.redisService.get(dedupeKey);
    if (duplicated) {
      return { status: 'duplicate', message: 'Webhook already processed' };
    }

    const result = await this.handleFeeWebhook(
      params.payload,
      provider.name,
      provider.code,
    );
    await this.redisService.set(dedupeKey, '1', 3600);
    return result;
  }

  private async handleFeeWebhook(
    payload: unknown,
    partnerName: string,
    providerCode: string,
  ) {
    const body = payload as {
      reference_no?: string;
      shipping_method_no?: string;
      data?: Array<{
        fee_kind_code?: string;
        currency_code?: string;
        currency_amount?: string;
      }>;
    };

    if (!body.reference_no && !body.shipping_method_no) {
      throw new BadRequestException(
        'fee Webhook 至少需要 reference_no 或 shipping_method_no',
      );
    }
    if (!Array.isArray(body.data)) {
      throw new BadRequestException('fee Webhook 的 data 必須是陣列');
    }

    const shipment = await this.findShipmentByReference(
      body.reference_no,
      body.shipping_method_no,
    );
    const createdCharges: string[] = [];
    for (const item of body.data) {
      if (!item.fee_kind_code || !item.currency_code || !item.currency_amount) {
        continue;
      }
      const charge = await this.chargeService.createFromLogttFee({
        shipmentId: shipment.id,
        feeCode: await this.logisticsProviderService.resolveInternalFeeCode(
          providerCode,
          item.fee_kind_code,
        ),
        currency: item.currency_code,
        amount: item.currency_amount,
        exchangeRate: '1',
        partnerName,
      });
      createdCharges.push(charge.id);
    }

    return {
      status: 'success',
      datatype: 'fee',
      provider: partnerName,
      providerCode,
      createdChargeCount: createdCharges.length,
      createdChargeIds: createdCharges,
    };
  }

  private async findShipmentByReference(
    referenceNo?: string,
    shippingMethodNo?: string,
  ) {
    const shipment = await this.prisma.client.shipment.findFirst({
      where: {
        OR: [
          { internalNo: referenceNo },
          { referenceNo: referenceNo },
          { mblNumber: shippingMethodNo },
        ],
      },
      select: { id: true },
    });

    if (!shipment) {
      throw new BadRequestException('找不到對應 Shipment，無法入帳物流費用');
    }
    return shipment;
  }

  private async verifyLogttSignature(input: {
    datatype: LogisticsWebhookHeadersDto['datatype'];
    sign: string;
    timestamp: string;
    rawBody: string;
  }) {
    const credential = await this.getActiveLogttCredential();

    const now = Date.now();
    const timestamp = Number(input.timestamp);
    if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 5 * 60 * 1000) {
      throw new UnauthorizedException('Webhook timestamp 無效或已過期');
    }

    const source = `${input.rawBody}${input.datatype}${credential.appKey}${input.timestamp}`;
    const expected = createHash('md5').update(source).digest('hex');

    if (expected.toLowerCase() !== input.sign.toLowerCase()) {
      throw new UnauthorizedException('Webhook 簽名驗證失敗');
    }
  }

  private async getActiveLogttCredential() {
    const tenantId = this.getTenantId();
    const credential = await this.prisma.client.tenantApiCredential.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'LOGTT',
        },
      },
      select: {
        appToken: true,
        appKey: true,
        isActive: true,
      },
    });

    if (!credential?.isActive) {
      throw new UnauthorizedException('尚未設定或啟用 LogTT API 憑證');
    }

    return credential;
  }

  private validateSpreadsheetFile(file: UploadedFilePayload) {
    const fileName = file.originalname?.toLowerCase() ?? '';
    const allowedExtensions = ['.csv', '.xls', '.xlsx', '.xlsm'];
    const allowedMimes = new Set([
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroenabled.12',
      'application/octet-stream',
    ]);

    const hasAllowedExtension = allowedExtensions.some((ext) =>
      fileName.endsWith(ext),
    );
    if (!hasAllowedExtension || !allowedMimes.has(file.mimetype)) {
      throw new BadRequestException(
        '僅支援上傳 Excel/CSV 檔案格式（csv/xls/xlsx/xlsm）',
      );
    }
  }

  async enqueueWebhookRetry(input: {
    source: 'LOGTT' | 'PROVIDER';
    tenantId: string;
    providerCode: string;
    payload: unknown;
    rawBody: string;
    headers?: LogisticsWebhookHeadersDto;
    signature?: string;
    timestamp?: string;
    attempts?: number;
    lastError?: string;
  }) {
    const attempts = input.attempts ?? 0;
    const backoffSec = Math.min(60, 2 ** attempts);
    const job: WebhookRetryJob = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source: input.source,
      tenantId: input.tenantId,
      providerCode: input.providerCode.toUpperCase(),
      payload: input.payload,
      rawBody: input.rawBody,
      headers: input.headers,
      signature: input.signature,
      timestamp: input.timestamp,
      attempts,
      maxAttempts: RETRY_MAX_ATTEMPTS,
      nextRetryAt: Date.now() + backoffSec * 1000,
      lastError: input.lastError,
    };

    await this.redisService.lpush(WEBHOOK_RETRY_QUEUE_KEY, JSON.stringify(job));
    return { status: 'queued', jobId: job.id, attempts: job.attempts };
  }

  async processRetryQueue(limit = 10) {
    const processed: Array<{ id: string; status: string; attempts: number }> = [];

    for (let i = 0; i < limit; i += 1) {
      const raw = await this.redisService.rpop(WEBHOOK_RETRY_QUEUE_KEY);
      if (!raw) {
        break;
      }

      let job: WebhookRetryJob;
      try {
        job = JSON.parse(raw) as WebhookRetryJob;
      } catch {
        continue;
      }

      if (Date.now() < job.nextRetryAt) {
        await this.redisService.rpush(WEBHOOK_RETRY_QUEUE_KEY, raw);
        continue;
      }

      try {
        await this.retrySingleJob(job);
        processed.push({ id: job.id, status: 'success', attempts: job.attempts });
      } catch (error) {
        const attempts = job.attempts + 1;
        if (attempts >= job.maxAttempts) {
          const deadJob: WebhookRetryJob = {
            ...job,
            attempts,
            lastError: String(error),
          };
          await this.redisService.lpush(
            WEBHOOK_DEADLETTER_QUEUE_KEY,
            JSON.stringify(deadJob),
          );
          processed.push({ id: job.id, status: 'dead-letter', attempts });
        } else {
          await this.enqueueWebhookRetry({
            source: job.source,
            tenantId: job.tenantId,
            providerCode: job.providerCode,
            payload: job.payload,
            rawBody: job.rawBody,
            headers: job.headers,
            signature: job.signature,
            timestamp: job.timestamp,
            attempts,
            lastError: String(error),
          });
          processed.push({ id: job.id, status: 'requeued', attempts });
        }
      }
    }

    const queueLength = await this.redisService.llen(WEBHOOK_RETRY_QUEUE_KEY);
    const deadLength = await this.redisService.llen(WEBHOOK_DEADLETTER_QUEUE_KEY);
    return {
      processed,
      queueLength,
      deadLetterLength: deadLength,
    };
  }

  async getDeadLetterItems(limit = 100, filter?: DeadLetterFilter) {
    const allRaw = await this.redisService.lrange(
      WEBHOOK_DEADLETTER_QUEUE_KEY,
      0,
      -1,
    );
    const jobs: WebhookRetryJob[] = [];

    for (const raw of allRaw) {
      try {
        const parsed = JSON.parse(raw) as WebhookRetryJob;
        if (filter?.providerCode) {
          const providerCode = filter.providerCode.trim().toUpperCase();
          if (parsed.providerCode !== providerCode) {
            continue;
          }
        }
        if (filter?.source && parsed.source !== filter.source) {
          continue;
        }
        jobs.push(parsed);
        if (jobs.length >= limit) {
          break;
        }
      } catch {
        // ignore invalid payload
      }
    }

    return jobs;
  }

  async requeueDeadLetterJob(jobId: string) {
    if (!jobId) {
      throw new BadRequestException('jobId 不可為空');
    }

    const deadItemsRaw = await this.redisService.lrange(
      WEBHOOK_DEADLETTER_QUEUE_KEY,
      0,
      -1,
    );
    if (deadItemsRaw.length === 0) {
      throw new BadRequestException('dead-letter 佇列為空');
    }

    const remaining: string[] = [];
    let targetJob: WebhookRetryJob | null = null;

    for (const raw of deadItemsRaw) {
      try {
        const parsed = JSON.parse(raw) as WebhookRetryJob;
        if (parsed.id === jobId && !targetJob) {
          targetJob = parsed;
          continue;
        }
      } catch {
        // 保留壞資料，避免誤刪
      }
      remaining.push(raw);
    }

    if (!targetJob) {
      throw new BadRequestException(`找不到 dead-letter job：${jobId}`);
    }

    await this.overwriteQueue(WEBHOOK_DEADLETTER_QUEUE_KEY, remaining);

    await this.enqueueWebhookRetry({
      source: targetJob.source,
      tenantId: targetJob.tenantId,
      providerCode: targetJob.providerCode,
      payload: targetJob.payload,
      rawBody: targetJob.rawBody,
      headers: targetJob.headers,
      signature: targetJob.signature,
      timestamp: targetJob.timestamp,
      attempts: 0,
      lastError: undefined,
    });

    return {
      status: 'requeued',
      jobId: targetJob.id,
    };
  }

  async requeueDeadLetterBatch(input?: {
    providerCode?: string;
    source?: 'LOGTT' | 'PROVIDER';
    limit?: number;
  }) {
    const limit = Math.max(1, Math.min(200, input?.limit ?? 20));
    const allRaw = await this.redisService.lrange(
      WEBHOOK_DEADLETTER_QUEUE_KEY,
      0,
      -1,
    );
    if (allRaw.length === 0) {
      return { requeuedCount: 0, requeuedJobIds: [] };
    }

    const remaining: string[] = [];
    const toRequeue: WebhookRetryJob[] = [];
    const providerCode = input?.providerCode?.trim().toUpperCase();
    const source = input?.source;

    for (const raw of allRaw) {
      try {
        const job = JSON.parse(raw) as WebhookRetryJob;
        const providerMatched = providerCode
          ? job.providerCode === providerCode
          : true;
        const sourceMatched = source ? job.source === source : true;

        if (providerMatched && sourceMatched && toRequeue.length < limit) {
          toRequeue.push(job);
          continue;
        }
      } catch {
        // keep invalid payload in dead-letter
      }
      remaining.push(raw);
    }

    await this.overwriteQueue(WEBHOOK_DEADLETTER_QUEUE_KEY, remaining);
    for (const job of toRequeue) {
      await this.enqueueWebhookRetry({
        source: job.source,
        tenantId: job.tenantId,
        providerCode: job.providerCode,
        payload: job.payload,
        rawBody: job.rawBody,
        headers: job.headers,
        signature: job.signature,
        timestamp: job.timestamp,
        attempts: 0,
        lastError: undefined,
      });
    }

    return {
      requeuedCount: toRequeue.length,
      requeuedJobIds: toRequeue.map((item) => item.id),
    };
  }

  async getRetryQueueStats() {
    const queueLength = await this.redisService.llen(WEBHOOK_RETRY_QUEUE_KEY);
    const deadLetterLength = await this.redisService.llen(
      WEBHOOK_DEADLETTER_QUEUE_KEY,
    );
    return {
      queueLength,
      deadLetterLength,
      maxAttempts: RETRY_MAX_ATTEMPTS,
    };
  }

  private async retrySingleJob(job: WebhookRetryJob) {
    await this.clsService.run(async () => {
      this.clsService.set('tenant_id', job.tenantId);
      this.clsService.set('user_id', 'system-webhook-retry');

      if (job.source === 'LOGTT') {
        if (!job.headers) {
          throw new Error('LOGTT retry job 缺少 headers');
        }
        await this.handleLogisticsWebhook({
          headers: job.headers,
          payload: job.payload,
          rawBody: job.rawBody,
        });
        return;
      }

      await this.handleProviderFeeWebhook({
        providerCode: job.providerCode,
        payload: job.payload,
        rawBody: job.rawBody,
        signature: job.signature,
        timestamp: job.timestamp,
      });
    });
  }

  private async overwriteQueue(key: string, items: string[]) {
    await this.redisService.del(key);
    for (const item of [...items].reverse()) {
      await this.redisService.lpush(key, item);
    }
  }
}