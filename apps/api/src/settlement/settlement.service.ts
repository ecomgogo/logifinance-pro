import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSettlementDto } from './settlement.dto';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async create(dto: CreateSettlementDto) {
    const tenantId = this.cls.get('tenant_id');

    return this.prisma.client.settlement.create({
      data: {
        tenantId,
        chargeId: dto.chargeId,
        paidAmount: dto.paidAmount,
        paymentDate: new Date(dto.paymentDate), // 字串轉為 Date 物件
      },
    });
  }
}