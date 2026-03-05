import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import Decimal from 'decimal.js';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly redisService: RedisService,
  ) {}

  async getStats() {
    // 🌟 加上 as string 明確告訴 TypeScript 這些變數是字串
    const tenantId = this.cls.get('tenant_id') as string;
    const userId = this.cls.get('user_id') as string;
    const userRole = this.cls.get('user_role') as string;

    // 🌟 解決 Prisma Where 型別衝突：改用物件動態賦值
    const shipmentWhere: any = { tenantId };
    if (userRole === 'SALES') {
      shipmentWhere.salesId = userId;
    }

    // 1. 計算累計總應收（優先採用記帳 AR，若未記帳則採用 Shipment 應收估算值）
    const shipments = await this.prisma.client.shipment.findMany({
      where: shipmentWhere,
      select: { id: true, currency: true, receivableAmount: true },
    });
    
    const shipmentIds = shipments.map(s => s.id);
    const baseCurrency = await this.getBaseCurrency(tenantId);

    let totalRevenue = new Decimal(0);
    if (shipmentIds.length > 0) {
      const arChargeGroups = await this.prisma.client.charge.groupBy({
        by: ['shipmentId'],
        where: {
          tenantId,
          shipmentId: { in: shipmentIds },
          arApType: 'AR',
        },
        _sum: { baseAmount: true },
      });
      const arByShipment = new Map(
        arChargeGroups.map((row) => [row.shipmentId || '', new Decimal(row._sum.baseAmount || 0)]),
      );

      for (const shipment of shipments) {
        const charged = arByShipment.get(shipment.id);
        if (charged && charged.gt(0)) {
          totalRevenue = totalRevenue.plus(charged);
          continue;
        }
        if (shipment.receivableAmount && new Decimal(shipment.receivableAmount).gt(0)) {
          const converted = await this.convertToBase(
            baseCurrency,
            tenantId,
            new Decimal(shipment.receivableAmount),
            shipment.currency,
          );
          totalRevenue = totalRevenue.plus(converted);
        }
      }
    }

    // 2. 計算過去 6 個月的圖表趨勢資料
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const recentShipments = await this.prisma.client.shipment.findMany({
      where: {
        ...shipmentWhere,
        createdAt: { gte: sixMonthsAgo }
      },
      select: { type: true, createdAt: true }
    });

    // 🌟 解決 TypeScript 隱式 any[] 報錯：明確定義陣列內容的型別
    const chartData: {
      month: string;
      commercialExpress: number;
      postalSmallParcel: number;
      dedicatedLine: number;
      yearMonth: string;
    }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = `${d.getMonth() + 1}月`;
      chartData.push({
        month: monthStr,
        commercialExpress: 0,
        postalSmallParcel: 0,
        dedicatedLine: 0,
        yearMonth: `${d.getFullYear()}-${d.getMonth()}`,
      });
    }

    // 將真實資料塞入對應的月份
    recentShipments.forEach(s => {
      const d = new Date(s.createdAt);
      const yearMonth = `${d.getFullYear()}-${d.getMonth()}`;
      const target = chartData.find(c => c.yearMonth === yearMonth);
      if (target) {
        if (s.type === 'COMMERCIAL_EXPRESS') target.commercialExpress += 1;
        if (s.type === 'POSTAL_SMALL_PARCEL') target.postalSmallParcel += 1;
        if (s.type === 'DEDICATED_LINE') target.dedicatedLine += 1;
        // 舊資料相容：歷史運輸類型仍可能是 AIR / OCEAN。
        if (s.type === 'AIR') target.commercialExpress += 1;
        if (s.type === 'OCEAN') target.dedicatedLine += 1;
      }
    });

    return {
      totalRevenue: Number(totalRevenue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()),
      chartData: chartData.map(
        ({ month, commercialExpress, postalSmallParcel, dedicatedLine }) => ({
          month,
          commercialExpress,
          postalSmallParcel,
          dedicatedLine,
        }),
      ),
    };
  }

  private async getBaseCurrency(tenantId: string): Promise<string> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { baseCurrency: true },
    });
    return (tenant?.baseCurrency || 'HKD').toUpperCase();
  }

  private async convertToBase(
    baseCurrency: string,
    tenantId: string,
    amount: Decimal,
    currency: string | null,
  ): Promise<Decimal> {
    const targetCurrency = (currency || baseCurrency).toUpperCase();
    if (targetCurrency === baseCurrency) {
      return amount;
    }
    const rate = await this.resolveRate(tenantId, baseCurrency, targetCurrency);
    if (rate.lte(0)) {
      return amount;
    }
    return amount.div(rate);
  }

  private async resolveRate(
    tenantId: string,
    baseCurrency: string,
    targetCurrency: string,
  ): Promise<Decimal> {
    const manualRaw = await this.redisService.get(
      `${tenantId}:settings:manual_exchange_rates`,
    );
    if (manualRaw) {
      try {
        const manualMap = JSON.parse(manualRaw) as Record<string, string>;
        const manual = manualMap[targetCurrency];
        if (manual) {
          return new Decimal(manual);
        }
      } catch {
        // ignore bad data
      }
    }

    const cacheKey = `${tenantId}:ext_api:exchange_rate:${baseCurrency}:${targetCurrency}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return new Decimal(cached);
    }

    return new Decimal(1);
  }
}