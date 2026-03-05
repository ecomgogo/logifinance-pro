import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe, Delete } from '@nestjs/common';
import { ChargeService } from './charge.service';
import { CreateChargeDto } from './charge.dto';
import { AuthGuard } from '../auth';

@Controller('charges')
@UseGuards(AuthGuard)
export class ChargeController {
  constructor(private readonly chargeService: ChargeService) {}

  @Post()
  async create(@Body() dto: CreateChargeDto) {
    return this.chargeService.create(dto);
  }

  @Get('shipment/:shipmentId')
  async findByShipment(@Param('shipmentId', ParseUUIDPipe) shipmentId: string) {
    return this.chargeService.findByShipment(shipmentId);
  }

  // 🌟 新增：刪除單筆費用的 API 端點
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.chargeService.remove(id);
  }
}