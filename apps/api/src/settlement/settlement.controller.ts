import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { CreateSettlementDto } from './settlement.dto';
import { AuthGuard } from '../auth';

@Controller('settlements')
@UseGuards(AuthGuard)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post()
  async create(@Body() dto: CreateSettlementDto) {
    return this.settlementService.create(dto);
  }
}