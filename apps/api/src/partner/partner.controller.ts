import { Controller, Get, UseGuards } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { AuthGuard } from '../auth';

@Controller('partners')
@UseGuards(AuthGuard)
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @Get()
  async findAll() {
    return this.partnerService.findAll();
  }
}