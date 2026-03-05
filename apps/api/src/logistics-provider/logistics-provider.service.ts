import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import {
  CreateLogisticsProviderDto,
  UpsertFeeCodeMappingDto,
  UpsertProviderCredentialDto,
} from './logistics-provider.dto';
import { ProviderType } from '../../generated/prisma';

const BUILTIN_PROVIDERS: Array<{
  code: string;
  name: string;
  type: ProviderType;
}> = [
  { code: 'LOGTT', name: '速遞管家', type: ProviderType.LOGTT },
  { code: 'DHL', name: 'DHL', type: ProviderType.DHL },
  { code: 'FEDEX', name: 'FEDEX', type: ProviderType.FEDEX },
  { code: 'UPS', name: 'UPS', type: ProviderType.UPS },
];

@Injectable()
export class LogisticsProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async bootstrapBuiltinProviders() {
    const tenantId = this.getTenantId();
    const results: Array<{ id: string; code: string; name: string }> = [];
    for (const provider of BUILTIN_PROVIDERS) {
      const item = await this.prisma.client.logisticsProvider.upsert({
        where: {
          tenantId_code: {
            tenantId,
            code: provider.code,
          },
        },
        update: {
          name: provider.name,
          type: provider.type,
          isBuiltin: true,
          isActive: true,
        },
        create: {
          tenantId,
          code: provider.code,
          name: provider.name,
          type: provider.type,
          isBuiltin: true,
          isActive: true,
        },
      });
      results.push({ id: item.id, code: item.code, name: item.name });
    }
    return results;
  }

  async findAll() {
    return this.prisma.client.logisticsProvider.findMany({
      orderBy: [{ isBuiltin: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateLogisticsProviderDto) {
    const normalizedCode =
      dto.code?.trim().toUpperCase() ?? this.normalizeCode(dto.name);
    if (!normalizedCode) {
      throw new BadRequestException('供應商代碼不可為空');
    }

    return this.prisma.client.logisticsProvider.create({
      data: {
        tenantId: this.getTenantId(),
        code: normalizedCode,
        name: dto.name.trim(),
        type: dto.type ?? 'CUSTOM',
        isBuiltin: false,
        appToken: dto.appToken,
        appKey: dto.appKey,
        webhookSecret: dto.webhookSecret,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async upsertCredentials(code: string, dto: UpsertProviderCredentialDto) {
    const provider = await this.findProviderByCode(code);

    return this.prisma.client.logisticsProvider.update({
      where: { id: provider.id },
      data: {
        appToken: dto.appToken,
        appKey: dto.appKey,
        webhookSecret: dto.webhookSecret,
      },
    });
  }

  async listFeeMappings(code: string) {
    const provider = await this.findProviderByCode(code);
    return this.prisma.client.logisticsFeeCodeMapping.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertFeeMapping(code: string, dto: UpsertFeeCodeMappingDto) {
    const provider = await this.findProviderByCode(code);
    return this.prisma.client.logisticsFeeCodeMapping.upsert({
      where: {
        tenantId_providerId_externalFeeCode: {
          tenantId: this.getTenantId(),
          providerId: provider.id,
          externalFeeCode: dto.externalFeeCode.trim().toUpperCase(),
        },
      },
      update: {
        internalFeeCode: dto.internalFeeCode.trim().toUpperCase(),
        defaultArApType: dto.defaultArApType ?? 'AP',
      },
      create: {
        tenantId: this.getTenantId(),
        providerId: provider.id,
        externalFeeCode: dto.externalFeeCode.trim().toUpperCase(),
        internalFeeCode: dto.internalFeeCode.trim().toUpperCase(),
        defaultArApType: dto.defaultArApType ?? 'AP',
      },
    });
  }

  async resolveInternalFeeCode(
    providerCode: string,
    externalFeeCode: string,
  ): Promise<string> {
    const provider = await this.findProviderByCode(providerCode);
    const mapping = await this.prisma.client.logisticsFeeCodeMapping.findUnique({
      where: {
        tenantId_providerId_externalFeeCode: {
          tenantId: this.getTenantId(),
          providerId: provider.id,
          externalFeeCode: externalFeeCode.trim().toUpperCase(),
        },
      },
      select: { internalFeeCode: true },
    });

    if (mapping?.internalFeeCode) {
      return mapping.internalFeeCode;
    }

    return externalFeeCode.trim().toUpperCase();
  }

  async getActiveProviderCredential(code: string) {
    const provider = await this.prisma.client.logisticsProvider.findUnique({
      where: {
        tenantId_code: {
          tenantId: this.getTenantId(),
          code: code.trim().toUpperCase(),
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        appToken: true,
        appKey: true,
        isActive: true,
      },
    });

    if (!provider || !provider.isActive) {
      throw new BadRequestException(`供應商未啟用或不存在：${code}`);
    }
    if (!provider.appToken || !provider.appKey) {
      throw new BadRequestException(
        `供應商 ${provider.code} 尚未完成 API 憑證設定（appToken/appKey）`,
      );
    }

    return {
      ...provider,
      appToken: provider.appToken,
      appKey: provider.appKey,
    };
  }

  private normalizeCode(name: string): string {
    return name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private async findProviderByCode(code: string) {
    const providerCode = code.trim().toUpperCase();
    const provider = await this.prisma.client.logisticsProvider.findUnique({
      where: {
        tenantId_code: {
          tenantId: this.getTenantId(),
          code: providerCode,
        },
      },
      select: { id: true, code: true, name: true },
    });
    if (!provider) {
      throw new BadRequestException(`找不到供應商代碼：${providerCode}`);
    }
    return provider;
  }

  private getTenantId(): string {
    const tenantId = this.cls.get('tenant_id') as string | undefined;
    if (!tenantId) {
      throw new UnauthorizedException('缺少租戶資訊，請先登入');
    }
    return tenantId;
  }
}
