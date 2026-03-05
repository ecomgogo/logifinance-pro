// apps/api/src/shipment/shipment.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import { CreateShipmentDto } from './shipment.dto';
import { AuthGuard } from '../auth'; // 🌟 關鍵修改：直接從 ../auth 引入，乾淨又不會錯！

@Controller('shipments') 
@UseGuards(AuthGuard) 
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