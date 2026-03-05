import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './user.dto';
import { UserRole } from '../../generated/prisma'; // 🌟 關鍵修復 1：引入 Prisma 自動生成的 Enum

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
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
}