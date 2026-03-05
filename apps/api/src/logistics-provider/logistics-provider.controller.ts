import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth';
import { LogisticsProviderService } from './logistics-provider.service';
import {
  CreateLogisticsProviderDto,
  UpsertFeeCodeMappingDto,
  UpsertProviderCredentialDto,
} from './logistics-provider.dto';

@Controller('logistics-providers')
@UseGuards(AuthGuard)
export class LogisticsProviderController {
  constructor(
    private readonly logisticsProviderService: LogisticsProviderService,
  ) {}

  @Post('bootstrap-fixed')
  async bootstrapFixedProviders() {
    return this.logisticsProviderService.bootstrapBuiltinProviders();
  }

  @Get()
  async findAll() {
    return this.logisticsProviderService.findAll();
  }

  @Post()
  async create(@Body() dto: CreateLogisticsProviderDto) {
    return this.logisticsProviderService.create(dto);
  }

  @Post(':code/credentials')
  async upsertCredentials(
    @Param('code') code: string,
    @Body() dto: UpsertProviderCredentialDto,
  ) {
    return this.logisticsProviderService.upsertCredentials(code, dto);
  }

  @Get(':code/fee-mappings')
  async listFeeMappings(@Param('code') code: string) {
    return this.logisticsProviderService.listFeeMappings(code);
  }

  @Post(':code/fee-mappings')
  async upsertFeeMapping(
    @Param('code') code: string,
    @Body() dto: UpsertFeeCodeMappingDto,
  ) {
    return this.logisticsProviderService.upsertFeeMapping(code, dto);
  }
}
