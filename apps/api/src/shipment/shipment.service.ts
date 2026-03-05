// apps/api/src/shipment/shipment.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShipmentDto } from './shipment.dto';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async create(dto: CreateShipmentDto) {
    const userId = this.cls.get('user_id');
    const tenantId = this.cls.get('tenant_id');

    return this.prisma.client.shipment.create({
      data: {
        tenantId: tenantId,
        salesId: userId,
        internalNo: dto.internalNo,
        type: dto.type,
        mblNumber: dto.mblNumber,
      },
    });
  }

  // 🌟 權限升級：依據角色撈取運單列表
  async findAll() {
    const userId = this.cls.get('user_id');
    const userRole = this.cls.get('user_role');

    // 如果是業務，強制加上只能看自己的條件
    const whereClause = userRole === 'SALES' ? { salesId: userId } : {};

    return this.prisma.client.shipment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        sales: {
          select: { email: true, role: true }
        }
      }
    });
  }

  // 🌟 權限升級：讀取單筆時也要防止業務偷看別人的單
  async findOne(id: string) {
    const userId = this.cls.get('user_id');
    const userRole = this.cls.get('user_role');

    const whereClause: any = { id };
    if (userRole === 'SALES') {
      whereClause.salesId = userId;
    }

    // 注意：因為加入了 salesId 條件，從 findUnique 改用 findFirst
    const shipment = await this.prisma.client.shipment.findFirst({
      where: whereClause,
      include: {
        sales: {
          select: { email: true, role: true }
        }
      }
    });

    if (!shipment) {
      throw new NotFoundException('找不到該運單，或者您沒有權限查看');
    }

    return shipment;
  }
}