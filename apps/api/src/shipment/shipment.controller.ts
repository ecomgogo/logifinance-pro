// apps/api/src/shipment/shipment.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import { CreateShipmentDto } from './shipment.dto';
import { AuthGuard } from '../auth/auth.guard'; // ✅ 現在這個檔案存在了！

@Controller('shipments') 
@UseGuards(AuthGuard) // 🛡️ 啟動守衛防護
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post()
  async create(@Body() dto: CreateShipmentDto) {
    return this.shipmentService.create(dto);
  }

  @Get()
  async findAll() {
    return this.shipmentService.findAll();
  }
}