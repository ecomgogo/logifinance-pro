import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChargeDto } from './charge.dto';
import { ClsService } from 'nestjs-cls';
import Decimal from 'decimal.js';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ChargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateChargeDto) {
    const tenantId = this.getTenantId();
    const baseCurrency = await this.getBaseCurrency(tenantId);
    const partnerType = dto.arApType === 'AR' ? 'Customer' : 'Vendor';

    let partner = await this.prisma.client.businessPartner.findFirst({
      where: { name: dto.partnerName, type: partnerType },
    });

    if (!partner) {
      partner = await this.prisma.client.businessPartner.create({
        data: { tenantId, name: dto.partnerName, type: partnerType },
      });
    }

    const amount = new Decimal(dto.amount);
    const resolvedRate = dto.exchangeRate
      ? dto.exchangeRate
      : await this.resolveExchangeRate(tenantId, baseCurrency, dto.currency);
    const exchangeRate = new Decimal(resolvedRate);
    if (!exchangeRate.isFinite() || exchangeRate.lte(0)) {
      throw new BadRequestException('匯率必須大於 0');
    }
    // 規則：exchangeRate 為「1 基準幣 = X 目標幣」，因此目標幣換回基準幣需除以匯率。
    const baseAmount = amount.div(exchangeRate);

    return this.prisma.client.charge.create({
      data: {
        tenantId,
        shipmentId: dto.shipmentId,
        partnerId: partner.id,
        arApType: dto.arApType,
        feeCode: dto.feeCode,
        currency: dto.currency,
        amount: amount.toString(),
        exchangeRate: exchangeRate.toString(),
        baseAmount: baseAmount.toString(),
      },
    });
  }

  async findByShipment(shipmentId: string) {
    return this.prisma.client.charge.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'desc' },
      include: {
        partner: { select: { name: true } },
        settlements: true
      }
    });
  }

  async recalculateBaseAmounts() {
    const tenantId = this.getTenantId();
    const userRole = this.cls.get('user_role') as string | undefined;
    if (userRole !== 'BOSS') {
      throw new ForbiddenException('只有老闆 (BOSS) 可執行歷史資料重算');
    }

    const charges = await this.prisma.client.charge.findMany({
      where: { tenantId },
      select: {
        id: true,
        amount: true,
        exchangeRate: true,
        baseAmount: true,
      },
    });

    let updated = 0;
    let unchanged = 0;
    let skippedInvalidRate = 0;

    for (const charge of charges) {
      const rate = new Decimal(charge.exchangeRate);
      if (!rate.isFinite() || rate.lte(0)) {
        skippedInvalidRate += 1;
        continue;
      }

      const recalculated = new Decimal(charge.amount).div(rate).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const oldValue = new Decimal(charge.baseAmount).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

      if (recalculated.equals(oldValue)) {
        unchanged += 1;
        continue;
      }

      await this.prisma.client.charge.update({
        where: { id: charge.id },
        data: { baseAmount: recalculated.toString() },
      });
      updated += 1;
    }

    return {
      message: '歷史費用 baseAmount 已按最新換算規則重算完成',
      total: charges.length,
      updated,
      unchanged,
      skippedInvalidRate,
    };
  }

  // 🌟 新增：帶有會計防護鎖的刪除功能
  async remove(id: string) {
    // 1. 先找出這筆費用，並把它的核銷紀錄一起撈出來
    const charge = await this.prisma.client.charge.findUnique({
      where: { id },
      include: { settlements: true },
    });

    if (!charge) {
      throw new NotFoundException('找不到該筆費用紀錄');
    }

    // 2. 🛡️ 會計防護鎖：檢查是否已經有核銷紀錄
    if (charge.settlements && charge.settlements.length > 0) {
      throw new BadRequestException('拒絕刪除：此筆費用已有收付款 (核銷) 紀錄！請先刪除核銷紀錄或進行作帳沖銷。');
    }

    // 3. 安全通關，執行刪除
    return this.prisma.client.charge.delete({
      where: { id },
    });
  }

  /**
   * 建立第三方物流費用（自動寫入應付 AP）。
   */
  async createFromLogttFee(input: {
    shipmentId: string;
    feeCode: string;
    currency: string;
    amount: string;
    exchangeRate?: string;
    partnerName: string;
  }) {
    const tenantId = this.getTenantId();
    const baseCurrency = await this.getBaseCurrency(tenantId);
    let partner = await this.prisma.client.businessPartner.findFirst({
      where: { name: input.partnerName, type: 'Vendor' },
    });

    if (!partner) {
      partner = await this.prisma.client.businessPartner.create({
        data: {
          tenantId,
          name: input.partnerName,
          type: 'Vendor',
        },
      });
    }

    const amount = new Decimal(input.amount);
    const resolvedRate = input.exchangeRate
      ? input.exchangeRate
      : await this.resolveExchangeRate(tenantId, baseCurrency, input.currency);
    const exchangeRate = new Decimal(resolvedRate);
    if (!exchangeRate.isFinite() || exchangeRate.lte(0)) {
      throw new BadRequestException('匯率必須大於 0');
    }
    const baseAmount = amount.div(exchangeRate);

    return this.prisma.client.charge.create({
      data: {
        tenantId,
        shipmentId: input.shipmentId,
        partnerId: partner.id,
        arApType: 'AP',
        feeCode: input.feeCode,
        currency: input.currency,
        amount: amount.toString(),
        exchangeRate: exchangeRate.toString(),
        baseAmount: baseAmount.toString(),
      },
    });
  }

  private getTenantId(): string {
    const tenantId = this.cls.get('tenant_id') as string | undefined;
    if (!tenantId) {
      throw new UnauthorizedException('缺少租戶資訊，請先登入');
    }
    return tenantId;
  }

  private async getBaseCurrency(tenantId: string): Promise<string> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { baseCurrency: true },
    });
    return (tenant?.baseCurrency || 'HKD').toUpperCase();
  }

  private async resolveExchangeRate(
    tenantId: string,
    baseCurrency: string,
    targetCurrency: string,
  ): Promise<string> {
    const normalizedTarget = (targetCurrency || '').toUpperCase();
    if (!normalizedTarget || normalizedTarget === baseCurrency) {
      return '1.00';
    }

    const manualRaw = await this.redisService.get(
      `${tenantId}:settings:manual_exchange_rates`,
    );
    if (manualRaw) {
      try {
        const manualMap = JSON.parse(manualRaw) as Record<string, string>;
        const manual = manualMap[normalizedTarget];
        if (manual) {
          return new Decimal(manual)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            .toString();
        }
      } catch {
        // 忽略髒資料，改走 API 匯率
      }
    }

    const cacheKey = `${tenantId}:ext_api:exchange_rate:${baseCurrency}:${normalizedTarget}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return new Decimal(cached).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString();
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `https://open.er-api.com/v6/latest/${encodeURIComponent(baseCurrency)}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        throw new Error(`外部匯率 API 錯誤 ${response.status}`);
      }
      const data = (await response.json()) as { rates?: Record<string, number> };
      const rate = data?.rates?.[normalizedTarget];
      if (!rate || Number.isNaN(rate)) {
        throw new Error('無法取得目標幣別匯率');
      }
      const normalized = new Decimal(rate)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toString();
      await this.redisService.set(cacheKey, normalized, 3600);
      return normalized;
    } catch {
      return '1.00';
    } finally {
      clearTimeout(timer);
    }
  }
}