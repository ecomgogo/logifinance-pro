import { Controller, Get, Post, Body, UseGuards, Param, ParseUUIDPipe } from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import { CreateShipmentDto } from './shipment.dto';
import { AuthGuard } from '../auth';

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

  // 🛡️ 同樣加上 ParseUUIDPipe 防護
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.shipmentService.findOne(id);
  }
}