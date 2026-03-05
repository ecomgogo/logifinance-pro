import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async getStats() {
    // 🌟 加上 as string 明確告訴 TypeScript 這些變數是字串
    const tenantId = this.cls.get('tenant_id') as string;
    const userId = this.cls.get('user_id') as string;
    const userRole = this.cls.get('user_role') as string;

    // 🌟 解決 Prisma Where 型別衝突：改用物件動態賦值
    const shipmentWhere: any = { tenantId };
    if (userRole === 'SALES') {
      shipmentWhere.salesId = userId;
    }

    // 1. 計算應收營收 (AR)
    const shipments = await this.prisma.client.shipment.findMany({
      where: shipmentWhere,
      select: { id: true }
    });
    
    const shipmentIds = shipments.map(s => s.id);

    // 如果沒有任何運單，直接跳過聚合計算，避免 Prisma 報錯
    let totalRevenue = 0;
    if (shipmentIds.length > 0) {
      const arCharges = await this.prisma.client.charge.aggregate({
        where: {
          tenantId,
          shipmentId: { in: shipmentIds },
          arApType: 'AR'
        },
        _sum: { baseAmount: true }
      });
      totalRevenue = Number(arCharges._sum.baseAmount || 0);
    }

    // 2. 計算過去 6 個月的圖表趨勢資料
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const recentShipments = await this.prisma.client.shipment.findMany({
      where: {
        ...shipmentWhere,
        createdAt: { gte: sixMonthsAgo }
      },
      select: { type: true, createdAt: true }
    });

    // 🌟 解決 TypeScript 隱式 any[] 報錯：明確定義陣列內容的型別
    const chartData: { month: string; ocean: number; air: number; yearMonth: string }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = `${d.getMonth() + 1}月`;
      chartData.push({ month: monthStr, ocean: 0, air: 0, yearMonth: `${d.getFullYear()}-${d.getMonth()}` });
    }

    // 將真實資料塞入對應的月份
    recentShipments.forEach(s => {
      const d = new Date(s.createdAt);
      const yearMonth = `${d.getFullYear()}-${d.getMonth()}`;
      const target = chartData.find(c => c.yearMonth === yearMonth);
      if (target) {
        if (s.type === 'OCEAN') target.ocean += 1;
        if (s.type === 'AIR') target.air += 1;
      }
    });

    return {
      totalRevenue,
      chartData: chartData.map(({ month, ocean, air }) => ({ month, ocean, air }))
    };
  }
}