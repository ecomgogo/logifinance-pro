import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { RedisService } from '../../redis/redis.service';
import { LogisticsProviderService } from '../../logistics-provider/logistics-provider.service';
import {
  LogisticsClient,
  NormalizedTrackingResult,
} from './logistics-client.interface';
import { fetchWithRetry, getProviderBaseUrl } from './provider-http.util';

@Injectable()
export class UpsClient implements LogisticsClient {
  readonly providerCode = 'UPS';

  constructor(
    private readonly cls: ClsService,
    private readonly redisService: RedisService,
    private readonly logisticsProviderService: LogisticsProviderService,
  ) {}

  async getTracking(trackingNumber: string): Promise<NormalizedTrackingResult> {
    const tenantId = this.cls.get('tenant_id') as string | undefined;
    if (!tenantId) {
      throw new UnauthorizedException('缺少租戶資訊，請先登入');
    }

    const token = await this.getAccessToken(tenantId);
    const response = await fetchWithRetry(
      `${getProviderBaseUrl('UPS')}/api/track/v1/details/${encodeURIComponent(
        trackingNumber,
      )}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          transId: `logifinance-${Date.now()}`,
          transactionSrc: 'logifinance-pro',
        },
      },
      { retryLabel: 'UPS Tracking API' },
    );
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`UPS Tracking API 失敗：${response.status} ${message}`);
    }

    const data = (await response.json()) as {
      trackResponse?: {
        shipment?: Array<{
          package?: Array<{
            activity?: Array<{
              date?: string;
              time?: string;
              status?: { description?: string; type?: string };
              location?: { address?: { city?: string; countryCode?: string } };
            }>;
            currentStatus?: { description?: string; type?: string };
          }>;
        }>;
      };
    };
    const pkg = data.trackResponse?.shipment?.[0]?.package?.[0];
    const events =
      pkg?.activity?.map((event) => ({
        occurredAt: event.date && event.time ? `${event.date} ${event.time}` : new Date().toISOString(),
        location:
          event.location?.address?.city ??
          event.location?.address?.countryCode ??
          'UNKNOWN',
        description: event.status?.description ?? '',
      })) ?? [];

    return {
      providerCode: this.providerCode,
      trackingNumber,
      status: pkg?.currentStatus?.type ?? 'UNKNOWN',
      statusName: pkg?.currentStatus?.description ?? '未知狀態',
      events,
    };
  }

  private async getAccessToken(tenantId: string): Promise<string> {
    const cacheKey = `${tenantId}:provider:${this.providerCode}:oauth-token`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const credential =
      await this.logisticsProviderService.getActiveProviderCredential(
        this.providerCode,
      );
    const basic = Buffer.from(
      `${credential.appToken}:${credential.appKey}`,
    ).toString('base64');

    const response = await fetchWithRetry(`${getProviderBaseUrl('UPS')}/security/v1/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    }, { retryLabel: 'UPS OAuth API' });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`UPS OAuth 失敗：${response.status} ${message}`);
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      throw new Error('UPS OAuth 未回傳 access_token');
    }
    const ttl = Math.max(60, (data.expires_in ?? 3600) - 60);
    await this.redisService.set(cacheKey, data.access_token, ttl);
    return data.access_token;
  }
}
