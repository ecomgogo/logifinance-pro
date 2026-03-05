import { InternalServerErrorException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { RedisService } from '../redis/redis.service';
import { IntegrationService } from './integration.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChargeService } from '../charge/charge.service';
import { LogisticsProviderService } from '../logistics-provider/logistics-provider.service';
import { DhlClient } from './providers/dhl.client';
import { FedexClient } from './providers/fedex.client';
import { UpsClient } from './providers/ups.client';

describe('IntegrationService', () => {
  let service: IntegrationService;
  let redisService: jest.Mocked<Pick<RedisService, 'get' | 'set'>>;
  let clsService: jest.Mocked<Pick<ClsService, 'get'>>;
  let prismaService: jest.Mocked<Pick<PrismaService, 'client'>>;
  let chargeService: jest.Mocked<Pick<ChargeService, 'createFromLogttFee'>>;
  let logisticsProviderService: jest.Mocked<
    Pick<LogisticsProviderService, 'resolveInternalFeeCode'>
  >;
  let dhlClient: jest.Mocked<Pick<DhlClient, 'providerCode' | 'getTracking'>>;
  let fedexClient: jest.Mocked<
    Pick<FedexClient, 'providerCode' | 'getTracking'>
  >;
  let upsClient: jest.Mocked<Pick<UpsClient, 'providerCode' | 'getTracking'>>;

  beforeEach(() => {
    redisService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    clsService = {
      get: jest.fn(),
    };

    prismaService = {
      client: {
        tenantApiCredential: {
          upsert: jest.fn(),
          findUnique: jest.fn(),
        },
        shipment: {
          findFirst: jest.fn(),
        },
      },
    } as unknown as jest.Mocked<Pick<PrismaService, 'client'>>;

    chargeService = {
      createFromLogttFee: jest.fn(),
    };
    logisticsProviderService = {
      resolveInternalFeeCode: jest.fn(),
    };
    dhlClient = {
      providerCode: 'DHL',
      getTracking: jest.fn(),
    };
    fedexClient = {
      providerCode: 'FEDEX',
      getTracking: jest.fn(),
    };
    upsClient = {
      providerCode: 'UPS',
      getTracking: jest.fn(),
    };

    (
      prismaService.client.tenantApiCredential.findUnique as jest.Mock
    ).mockResolvedValue({
      appToken: 'token',
      appKey: 'key',
      isActive: true,
    });

    service = new IntegrationService(
      redisService as unknown as RedisService,
      clsService as unknown as ClsService,
      prismaService as unknown as PrismaService,
      chargeService as unknown as ChargeService,
      logisticsProviderService as unknown as LogisticsProviderService,
      dhlClient as unknown as DhlClient,
      fedexClient as unknown as FedexClient,
      upsClient as unknown as UpsClient,
    );
  });

  it('parseDocument 應帶入 X-Tenant-ID header 呼叫 Python 服務', async () => {
    clsService.get.mockReturnValue('tenant_a');

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'success' }),
      } as Response);

    const result = await service.parseDocument({
      buffer: Buffer.from('customer_order_no,tracking_no\nA001,DHL0001'),
      mimetype: 'text/csv',
      originalname: 'test.csv',
    });

    expect(result).toEqual({ status: 'success' });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/parse', {
      method: 'POST',
      headers: {
        'X-Tenant-ID': 'tenant_a',
      },
      body: expect.any(FormData),
    });

    fetchMock.mockRestore();
  });

  it('getExchangeRate 應使用租戶前綴快取 key', async () => {
    clsService.get.mockReturnValue('tenant_b');
    redisService.get.mockResolvedValue(null);

    const rate = await service.getExchangeRate('USD');

    expect(rate).toBe(7.8);
    expect(redisService.get).toHaveBeenCalledWith(
      'tenant_b:ext_api:exchange_rate:USD',
    );
    expect(redisService.set).toHaveBeenCalledWith(
      'tenant_b:ext_api:exchange_rate:USD',
      '7.8',
      86400,
    );
  });

  it('getTrackingInfo 應使用租戶前綴 token key', async () => {
    clsService.get.mockReturnValue('tenant_c');
    redisService.get.mockResolvedValue('cached_token');

    const result = await service.getTrackingInfo('ABC-1234567');

    expect(redisService.get).toHaveBeenCalledWith(
      'tenant_c:ext_api:logistics:token',
    );
    expect(result.trackingNumber).toBe('ABC-1234567');
    expect(result.status).toBe('IN_TRANSIT');
  });

  it('parseDocument 在 Python 服務失敗時應拋 InternalServerErrorException', async () => {
    clsService.get.mockReturnValue('tenant_a');
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

    await expect(
      service.parseDocument({
        buffer: Buffer.from('error'),
        mimetype: 'text/csv',
        originalname: 'bad.csv',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    fetchMock.mockRestore();
  });
});
