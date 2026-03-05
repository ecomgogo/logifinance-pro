import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
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

  // 🛡️ 加上 ParseUUIDPipe：如果傳進來的不是有效 UUID (例如 "[id]")，會自動阻擋並回傳 400 錯誤
  @Get('shipment/:shipmentId')
  async findByShipment(@Param('shipmentId', ParseUUIDPipe) shipmentId: string) {
    return this.chargeService.findByShipment(shipmentId);
  }
}