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
export class FedexClient implements LogisticsClient {
  readonly providerCode = 'FEDEX';

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
      `${getProviderBaseUrl('FEDEX')}/track/v1/trackingnumbers`,
      {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        includeDetailedScans: true,
        trackingInfo: [{ trackingNumberInfo: { trackingNumber } }],
      }),
    },
      { retryLabel: 'FedEx Tracking API' },
    );
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`FedEx Tracking API 失敗：${response.status} ${message}`);
    }

    const data = (await response.json()) as {
      output?: {
        completeTrackResults?: Array<{
          trackResults?: Array<{
            latestStatusDetail?: { code?: string; description?: string };
            scanEvents?: Array<{
              date?: string;
              eventDescription?: string;
              scanLocation?: { city?: string; countryName?: string };
            }>;
          }>;
        }>;
      };
    };
    const track =
      data.output?.completeTrackResults?.[0]?.trackResults?.[0];
    const events =
      track?.scanEvents?.map((event) => ({
        occurredAt: event.date ?? new Date().toISOString(),
        location:
          event.scanLocation?.city ?? event.scanLocation?.countryName ?? 'UNKNOWN',
        description: event.eventDescription ?? '',
      })) ?? [];

    return {
      providerCode: this.providerCode,
      trackingNumber,
      status: track?.latestStatusDetail?.code ?? 'UNKNOWN',
      statusName: track?.latestStatusDetail?.description ?? '未知狀態',
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
    const form = new URLSearchParams();
    form.set('grant_type', 'client_credentials');
    form.set('client_id', credential.appToken);
    form.set('client_secret', credential.appKey);

    const response = await fetchWithRetry(
      `${getProviderBaseUrl('FEDEX')}/oauth/token`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    },
      { retryLabel: 'FedEx OAuth API' },
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`FedEx OAuth 失敗：${response.status} ${message}`);
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      throw new Error('FedEx OAuth 未回傳 access_token');
    }

    const ttl = Math.max(60, (data.expires_in ?? 3600) - 60);
    await this.redisService.set(cacheKey, data.access_token, ttl);
    return data.access_token;
  }
}
