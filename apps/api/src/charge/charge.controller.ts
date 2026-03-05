import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
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

  // 透過網址參數取得特定運單的費用 (例如 GET /charges/shipment/123)
  @Get('shipment/:shipmentId')
  async findByShipment(@Param('shipmentId') shipmentId: string) {
    return this.chargeService.findByShipment(shipmentId);
  }
}