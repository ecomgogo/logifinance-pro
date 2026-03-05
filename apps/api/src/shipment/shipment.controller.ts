import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  ParseUUIDPipe,
  Patch,
  Delete,
} from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  UpdateShipmentFinanceDto,
} from './shipment.dto';
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

  @Patch(':id/finance-fields')
  async updateFinanceFields(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipmentFinanceDto,
  ) {
    return this.shipmentService.updateFinanceFields(id, dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.shipmentService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.shipmentService.remove(id);
  }
}