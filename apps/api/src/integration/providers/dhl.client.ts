import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LogisticsProviderService } from '../../logistics-provider/logistics-provider.service';
import {
  LogisticsClient,
  NormalizedTrackingResult,
} from './logistics-client.interface';
import { fetchWithRetry, getProviderBaseUrl } from './provider-http.util';

@Injectable()
export class DhlClient implements LogisticsClient {
  readonly providerCode = 'DHL';

  constructor(
    private readonly cls: ClsService,
    private readonly logisticsProviderService: LogisticsProviderService,
  ) {}

  async getTracking(trackingNumber: string): Promise<NormalizedTrackingResult> {
    const tenantId = this.cls.get('tenant_id') as string | undefined;
    if (!tenantId) {
      throw new UnauthorizedException('缺少租戶資訊，請先登入');
    }

    const credential =
      await this.logisticsProviderService.getActiveProviderCredential(
        this.providerCode,
      );
    const authorization = Buffer.from(
      `${credential.appToken}:${credential.appKey}`,
    ).toString('base64');

    const endpoint = `${getProviderBaseUrl('DHL')}/track/shipments?trackingNumber=${encodeURIComponent(
      trackingNumber,
    )}`;
    const response = await fetchWithRetry(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: 'application/json',
      },
    }, { retryLabel: 'DHL Tracking API' });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`DHL Tracking API 失敗：${response.status} ${message}`);
    }

    const data = (await response.json()) as {
      shipments?: Array<{
        status?: { statusCode?: string; status?: string };
        events?: Array<{
          timestamp?: string;
          location?: { address?: { addressLocality?: string; countryCode?: string } };
          description?: string;
        }>;
      }>;
    };

    const shipment = data.shipments?.[0];
    const events =
      shipment?.events?.map((event) => ({
        occurredAt: event.timestamp ?? new Date().toISOString(),
        location:
          event.location?.address?.addressLocality ??
          event.location?.address?.countryCode ??
          'UNKNOWN',
        description: event.description ?? '',
      })) ?? [];

    return {
      providerCode: this.providerCode,
      trackingNumber,
      status: shipment?.status?.statusCode ?? 'UNKNOWN',
      statusName: shipment?.status?.status ?? '未知狀態',
      events,
    };
  }
}
