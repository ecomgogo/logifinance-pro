// apps/api/src/shipment/shipment.service.ts
import { Injectable } from '@nestjs/common';
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
    // 1. 從上下文中同時抓取當前登入者的 user_id 與 tenant_id
    const userId = this.cls.get('user_id');
    const tenantId = this.cls.get('tenant_id');

    // 2. 建立資料庫紀錄，將兩個必填的關聯 ID 都放進去
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

  async findAll() {
    return this.prisma.client.shipment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sales: {
          select: { email: true, role: true }
        }
      }
    });
  }

  // 👇 新增：讀取單筆運單資料
  async findOne(id: string) {
    return this.prisma.client.shipment.findUnique({
      where: { id },
      include: {
        sales: {
          select: { email: true, role: true }
        }
      }
    });
  }
}