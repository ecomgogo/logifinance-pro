import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChargeDto } from './charge.dto';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class ChargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async create(dto: CreateChargeDto) {
    const tenantId = this.cls.get('tenant_id');
    const partnerType = dto.arApType === 'AR' ? 'Customer' : 'Vendor';

    // 1. 自動尋找或建立業務夥伴 (這就是現代 SaaS 的流暢體驗！)
    let partner = await this.prisma.client.businessPartner.findFirst({
      where: { name: dto.partnerName, type: partnerType, tenantId }
    });

    if (!partner) {
      partner = await this.prisma.client.businessPartner.create({
        data: { tenantId, name: dto.partnerName, type: partnerType }
      });
    }

    // 2. 計算本位幣金額
    const baseAmount = dto.amount * (dto.exchangeRate || 1);

    // 3. 寫入費用明細
    return this.prisma.client.charge.create({
      data: {
        tenantId,
        shipmentId: dto.shipmentId,
        partnerId: partner.id, // 關聯剛剛找到或建立的 ID
        arApType: dto.arApType,
        feeCode: dto.feeCode,
        currency: dto.currency,
        amount: dto.amount,
        exchangeRate: dto.exchangeRate || 1,
        baseAmount: baseAmount,
      },
    });
  }

  async findByShipment(shipmentId: string) {
    return this.prisma.client.charge.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'desc' },
      include: {
        partner: { select: { name: true } }
      }
    });
  }
}