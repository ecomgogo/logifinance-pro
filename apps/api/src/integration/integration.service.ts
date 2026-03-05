import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { RedisService } from '../redis/redis.service';

interface UploadedFilePayload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

@Injectable()
export class IntegrationService {
  constructor(
    private readonly redisService: RedisService,
    private readonly clsService: ClsService,
  ) {}

  /**
   * 取得當前租戶 ID。若無租戶上下文（例如系統任務）則回傳 system。
   */
  private getTenantId(): string {
    const tenantId = this.clsService.get<string>('tenant_id');
    if (typeof tenantId === 'string' && tenantId.length > 0) {
      return tenantId;
    }
    return 'system';
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

    if (!token) {
      console.log('🔄 Token 已過期或不存在，向第三方物流系統重新請求 Token...');
      // 這裡模擬向第三方 API 發送 HTTP 請求獲取 Token
      // const res = await fetch('https://api.ecang.com/auth/token', { ... });
      token = `mock_token_${Date.now()}`; 
      
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
}