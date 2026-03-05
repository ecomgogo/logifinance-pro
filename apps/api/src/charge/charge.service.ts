import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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
    const tenantId = this.cls.get('tenant_id') as string;
    const partnerType = dto.arApType === 'AR' ? 'Customer' : 'Vendor';

    let partner = await this.prisma.client.businessPartner.findFirst({
      where: { name: dto.partnerName, type: partnerType, tenantId }
    });

    if (!partner) {
      partner = await this.prisma.client.businessPartner.create({
        data: { tenantId, name: dto.partnerName, type: partnerType }
      });
    }

    const baseAmount = dto.amount * (dto.exchangeRate || 1);

    return this.prisma.client.charge.create({
      data: {
        tenantId,
        shipmentId: dto.shipmentId,
        partnerId: partner.id,
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
        partner: { select: { name: true } },
        settlements: true
      }
    });
  }

  // 🌟 新增：帶有會計防護鎖的刪除功能
  async remove(id: string) {
    const tenantId = this.cls.get('tenant_id') as string;

    // 1. 先找出這筆費用，並把它的核銷紀錄一起撈出來
    const charge = await this.prisma.client.charge.findUnique({
      where: { id, tenantId },
      include: { settlements: true }
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
      where: { id }
    });
  }
}