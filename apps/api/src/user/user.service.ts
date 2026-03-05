import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import * as bcrypt from 'bcrypt';
import Decimal from 'decimal.js';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateExchangeRatesDto,
  UpdateUserSettingsDto,
} from './user.dto';
import { UserRole } from '../../generated/prisma'; // 🌟 關鍵修復 1：引入 Prisma 自動生成的 Enum
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateUserDto) {
    const tenantId = this.cls.get('tenant_id') as string;

    const existingUser = await this.prisma.client.user.findFirst({
      where: { email: dto.email }
    });
    if (existingUser) {
      throw new BadRequestException('這個 Email 已經被註冊過了');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.client.user.create({
      data: {
        tenantId,
        email: dto.email,
        passwordHash,
        role: UserRole.SALES, // 🌟 使用強型別 Enum 而不是純字串
        commissionRate: dto.commissionRate || 0,
      },
      select: { id: true, email: true, role: true, commissionRate: true, createdAt: true }
    });
  }

  async findAll() {
    const tenantId = this.cls.get('tenant_id') as string;
    return this.prisma.client.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, role: true, commissionRate: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  async changePassword(dto: ChangePasswordDto) {
    const userId = this.cls.get('user_id') as string | undefined;
    if (!userId) {
      throw new UnauthorizedException('請先登入');
    }
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('新密碼與確認密碼不一致');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('新密碼不可與舊密碼相同');
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('使用者不存在或已停用');
    }

    const matched = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matched) {
      throw new BadRequestException('舊密碼錯誤');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return { message: '密碼修改成功' };
  }

  async getCommissions(yearMonth?: string) {
    const tenantId = this.cls.get('tenant_id') as string;
    const userRole = this.cls.get('user_role') as string;

    if (userRole !== 'BOSS') {
      throw new ForbiddenException('權限不足：只有老闆 (BOSS) 有權限查看業績結算');
    }

    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (yearMonth) {
      const [year, month] = yearMonth.split('-');
      startDate = new Date(Number(year), Number(month) - 1, 1);
      endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
    }

    // 🌟 使用強型別 Enum 進行搜尋
    const users = await this.prisma.client.user.findMany({
      where: { tenantId, role: UserRole.SALES }, 
      select: { id: true, email: true, commissionRate: true }
    });

    // 🌟 關鍵修復 2：明確宣告 result 陣列裡面裝的物件結構 (解決 implicitly any[] 報錯)
    const result: {
      userId: string;
      email: string;
      commissionRate: number;
      shipmentCount: number;
      grossProfit: number;
      commission: number;
    }[] = [];

    for (const user of users) {
      const shipments = await this.prisma.client.shipment.findMany({
        where: {
          tenantId,
          salesId: user.id,
          createdAt: { gte: startDate, lte: endDate }
        },
        select: { id: true }
      });

      const shipmentIds = shipments.map(s => s.id);
      let totalAR = 0;
      let totalAP = 0;

      if (shipmentIds.length > 0) {
        const charges = await this.prisma.client.charge.findMany({
          where: { tenantId, shipmentId: { in: shipmentIds } },
          select: { arApType: true, baseAmount: true }
        });

        charges.forEach(c => {
          if (c.arApType === 'AR') totalAR += Number(c.baseAmount);
          if (c.arApType === 'AP') totalAP += Number(c.baseAmount);
        });
      }

      const grossProfit = totalAR - totalAP;
      const commission = grossProfit > 0 ? grossProfit * (Number(user.commissionRate) / 100) : 0;

      result.push({
        userId: user.id,
        email: user.email,
        commissionRate: Number(user.commissionRate),
        shipmentCount: shipments.length,
        grossProfit,
        commission
      });
    }

    return {
      period: yearMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      commissions: result
    };
  }

  async getMySettings() {
    const tenantId = this.cls.get('tenant_id') as string | undefined;
    if (!tenantId) {
      throw new UnauthorizedException('請先登入');
    }

    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        companyName: true,
        baseCurrency: true,
      },
    });
    return tenant;
  }

  async updateMySettings(dto: UpdateUserSettingsDto) {
    const tenantId = this.cls.get('tenant_id') as string | undefined;
    if (!tenantId) {
      throw new UnauthorizedException('請先登入');
    }

    return this.prisma.client.tenant.update({
      where: { id: tenantId },
      data: {
        baseCurrency: dto.baseCurrency.toUpperCase(),
      },
      select: {
        id: true,
        companyName: true,
        baseCurrency: true,
      },
    });
  }

  async getExchangeRates() {
    const tenantId = this.getTenantId();
    const baseCurrency = await this.getBaseCurrency(tenantId);
    const manualRates = await this.getManualRates(tenantId);
    const supportedCurrencies = ['HKD', 'USD', 'CNY', 'TWD'];

    const rates = await Promise.all(
      supportedCurrencies.map(async (currency) => {
        if (currency === baseCurrency) {
          return {
            currency,
            manualRate: null,
            resolvedRate: '1.00',
            source: 'base',
          };
        }
        if (manualRates[currency]) {
          return {
            currency,
            manualRate: manualRates[currency],
            resolvedRate: this.normalizeRate(manualRates[currency]),
            source: 'manual',
          };
        }
        const apiRateResult = await this.fetchApiRate(
          tenantId,
          baseCurrency,
          currency,
        );
        return {
          currency,
          manualRate: null,
          resolvedRate: apiRateResult.rate,
          source: apiRateResult.source,
          apiRefreshedAt: apiRateResult.refreshedAt,
          note:
            apiRateResult.source === 'api_fallback'
              ? '匯率 API 暫時不可用，已回退 1.00'
              : undefined,
        };
      }),
    );

    return { baseCurrency, rates };
  }

  async updateExchangeRates(dto: UpdateExchangeRatesDto) {
    const tenantId = this.getTenantId();
    const baseCurrency = await this.getBaseCurrency(tenantId);
    const supportedCurrencies = new Set(['HKD', 'USD', 'CNY', 'TWD']);
    const manualRates = await this.getManualRates(tenantId);

    for (const [currencyRaw, value] of Object.entries(dto.rates || {})) {
      const currency = currencyRaw.toUpperCase();
      if (!supportedCurrencies.has(currency) || currency === baseCurrency) {
        continue;
      }
      const normalized = (value ?? '').trim();
      if (!normalized) {
        delete manualRates[currency];
        continue;
      }
      const parsed = new Decimal(normalized);
      if (!parsed.isFinite() || parsed.lte(0)) {
        throw new BadRequestException(`${currency} 匯率必須是大於 0 的數字`);
      }
      manualRates[currency] = this.normalizeRate(parsed.toString());
      await this.redisService.del(this.getApiRateCacheKey(tenantId, baseCurrency, currency));
    }

    await this.redisService.set(
      this.getManualRatesKey(tenantId),
      JSON.stringify(manualRates),
    );

    return this.getExchangeRates();
  }

  async refreshApiExchangeRates() {
    const tenantId = this.getTenantId();
    const baseCurrency = await this.getBaseCurrency(tenantId);
    const manualRates = await this.getManualRates(tenantId);
    const supportedCurrencies = ['HKD', 'USD', 'CNY', 'TWD'];

    for (const currency of supportedCurrencies) {
      if (currency === baseCurrency || manualRates[currency]) {
        continue;
      }
      await this.redisService.del(
        this.getApiRateCacheKey(tenantId, baseCurrency, currency),
      );
      await this.fetchApiRate(tenantId, baseCurrency, currency);
    }

    return this.getExchangeRates();
  }

  private async getBaseCurrency(tenantId: string): Promise<string> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { baseCurrency: true },
    });
    return (tenant?.baseCurrency || 'HKD').toUpperCase();
  }

  private async getManualRates(
    tenantId: string,
  ): Promise<Record<string, string>> {
    const raw = await this.redisService.get(this.getManualRatesKey(tenantId));
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed || {};
    } catch {
      return {};
    }
  }

  private getManualRatesKey(tenantId: string): string {
    return `${tenantId}:settings:manual_exchange_rates`;
  }

  private getApiRateCacheKey(
    tenantId: string,
    baseCurrency: string,
    targetCurrency: string,
  ): string {
    return `${tenantId}:ext_api:exchange_rate:${baseCurrency}:${targetCurrency}`;
  }

  private normalizeRate(rate: string): string {
    return new Decimal(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString();
  }

  private async fetchApiRate(
    tenantId: string,
    baseCurrency: string,
    targetCurrency: string,
  ): Promise<{
    rate: string;
    source: 'api' | 'api_fallback';
    refreshedAt: string | null;
  }> {
    const cacheKey = this.getApiRateCacheKey(tenantId, baseCurrency, targetCurrency);
    const tsKey = this.getApiRateTimestampKey(
      tenantId,
      baseCurrency,
      targetCurrency,
    );
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      const cachedTs = await this.redisService.get(tsKey);
      return {
        rate: this.normalizeRate(cached),
        source: 'api',
        refreshedAt: cachedTs || null,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(
        `https://open.er-api.com/v6/latest/${encodeURIComponent(baseCurrency)}`,
        { signal: controller.signal },
      );
      if (!res.ok) {
        throw new Error(`外部匯率 API 錯誤: ${res.status}`);
      }
      const data = (await res.json()) as {
        result?: string;
        rates?: Record<string, number>;
      };
      const rawRate = data?.rates?.[targetCurrency];
      if (!rawRate || Number.isNaN(rawRate)) {
        throw new Error(`外部匯率 API 無 ${targetCurrency} 匯率`);
      }
      const normalized = this.normalizeRate(String(rawRate));
      const refreshedAt = new Date().toISOString();
      await this.redisService.set(cacheKey, normalized, 3600);
      await this.redisService.set(tsKey, refreshedAt, 3600);
      return { rate: normalized, source: 'api', refreshedAt };
    } catch {
      return { rate: '1.00', source: 'api_fallback', refreshedAt: null };
    } finally {
      clearTimeout(timer);
    }
  }

  private getApiRateTimestampKey(
    tenantId: string,
    baseCurrency: string,
    targetCurrency: string,
  ): string {
    return `${tenantId}:ext_api:exchange_rate_ts:${baseCurrency}:${targetCurrency}`;
  }

  private getTenantId(): string {
    const tenantId = this.cls.get('tenant_id') as string | undefined;
    if (!tenantId) {
      throw new UnauthorizedException('請先登入');
    }
    return tenantId;
  }
}