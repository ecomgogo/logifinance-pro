import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async findAll() {
    const tenantId = this.cls.get('tenant_id');
    
    // 🌟 一次性撈出所有業務夥伴，並包含他們底下的所有費用與核銷紀錄，讓前端算餘額
    return this.prisma.client.businessPartner.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        charges: {
          include: {
            settlements: true,
          },
        },
      },
    });
  }
}