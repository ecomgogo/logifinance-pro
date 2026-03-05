import { Controller, Get, Post, Body } from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import { CreateShipmentDto } from './shipment.dto';

// 🚨 注意這裡必須是複數 'shipments'，才能對應前端的 API
@Controller('shipments') 
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