// apps/api/src/shipment/shipment.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShipmentDto, UpdateShipmentDto } from './shipment.dto';
import { ClsService } from 'nestjs-cls';
import Decimal from 'decimal.js';

@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async create(dto: CreateShipmentDto) {
    const userId = this.cls.get('user_id');
    const tenantId = this.cls.get('tenant_id') as string;
    let internalNo = dto.internalNo?.trim();
    if (!internalNo) {
      internalNo = await this.generateUnique12DigitInternalNo(tenantId);
    }

    return this.prisma.client.shipment.create({
      data: {
        tenantId: tenantId,
        salesId: userId,
        internalNo,
        referenceNo: dto.referenceNo,
        type: dto.type,
        mblNumber: dto.mblNumber,
        shippingMethodCode: dto.shippingMethodCode,
        currency: dto.currency?.toUpperCase(),
        receivableAmount: dto.receivableAmount
          ? new Decimal(dto.receivableAmount).toString()
          : undefined,
        payableAmount: dto.payableAmount
          ? new Decimal(dto.payableAmount).toString()
          : undefined,
        remark: dto.remark,
      },
    });
  }

  async updateFinanceFields(
    id: string,
    dto: {
      currency?: string;
      receivableAmount?: string;
      payableAmount?: string;
      remark?: string;
    },
  ) {
    await this.ensureShipmentAccess(id);
    const data: Record<string, string | null> = {};
    if (dto.currency !== undefined) {
      data.currency = dto.currency ? dto.currency.toUpperCase() : null;
    }
    if (dto.receivableAmount !== undefined) {
      data.receivableAmount = dto.receivableAmount
        ? new Decimal(dto.receivableAmount).toString()
        : null;
    }
    if (dto.payableAmount !== undefined) {
      data.payableAmount = dto.payableAmount
        ? new Decimal(dto.payableAmount).toString()
        : null;
    }
    if (dto.remark !== undefined) {
      data.remark = dto.remark || null;
    }

    return this.prisma.client.shipment.update({
      where: { id },
      data,
    });
  }

  async update(id: string, dto: UpdateShipmentDto) {
    await this.ensureShipmentAccess(id);
    const data: {
      type?: 'COMMERCIAL_EXPRESS' | 'POSTAL_SMALL_PARCEL' | 'DEDICATED_LINE';
      mblNumber?: string | null;
      shippingMethodCode?: string | null;
    } = {};
    if (dto.type !== undefined) {
      data.type = dto.type;
    }
    if (dto.mblNumber !== undefined) {
      data.mblNumber = dto.mblNumber.trim() || null;
    }
    if (dto.shippingMethodCode !== undefined) {
      data.shippingMethodCode = dto.shippingMethodCode.trim() || null;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('請至少提供一個可更新欄位');
    }

    return this.prisma.client.shipment.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.ensureShipmentAccess(id);
    await this.prisma.client.shipment.delete({
      where: { id },
    });
    return { message: '業務單已刪除' };
  }

  private generateRandom12DigitInternalNo(): string {
    // 產生 12 位純數字，不以 0 開頭，避免被視為短碼。
    const first = Math.floor(Math.random() * 9) + 1;
    let rest = '';
    for (let i = 0; i < 11; i += 1) {
      rest += Math.floor(Math.random() * 10).toString();
    }
    return `${first}${rest}`;
  }

  private async generateUnique12DigitInternalNo(
    tenantId: string,
  ): Promise<string> {
    for (let i = 0; i < 8; i += 1) {
      const candidate = this.generateRandom12DigitInternalNo();
      const existed = await this.prisma.client.shipment.findFirst({
        where: { tenantId, internalNo: candidate },
        select: { id: true },
      });
      if (!existed) {
        return candidate;
      }
    }
    throw new ServiceUnavailableException('系統忙碌，請稍後再試建立業務單');
  }

  private async ensureShipmentAccess(id: string) {
    const userId = this.cls.get('user_id');
    const userRole = this.cls.get('user_role');
    const whereClause: { id: string; salesId?: string } = { id };
    if (userRole === 'SALES') {
      whereClause.salesId = userId;
    }
    const shipment = await this.prisma.client.shipment.findFirst({
      where: whereClause,
      select: { id: true },
    });
    if (!shipment) {
      throw new NotFoundException('找不到該運單，或者您沒有權限操作');
    }
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