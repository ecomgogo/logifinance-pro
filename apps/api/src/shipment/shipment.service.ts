import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShipmentDto } from './shipment.dto';
import { ClsService } from 'nestjs-cls'; // 引入 ClsService

@Injectable()
export class ShipmentService {
  // 注入 PrismaService 與 ClsService
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async create(dto: CreateShipmentDto) {
    // 1. 從上下文中抓取當前登入者的 ID (這在 TenantMiddleware 裡已經塞進去了)
    const userId = this.cls.get('user_id');

    // 2. 建立資料庫紀錄，補上缺少的 salesId
    return this.prisma.client.shipment.create({
      data: {
        internalNo: dto.internalNo,
        type: dto.type,
        mblNumber: dto.mblNumber,
        salesId: userId, 
      },
    });
  }

  async findAll() {
    return this.prisma.client.shipment.findMany({
      orderBy: { createdAt: 'desc' },
      // 可選：如果你希望列表順便把銷售人員的名字帶出來，可以加上 include
      include: {
        sales: {
          select: { email: true, role: true }
        }
      }
    });
  }
}