import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  Patch,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateExchangeRatesDto,
  UpdateUserSettingsDto,
} from './user.dto';
import { AuthGuard } from '../auth';

@Controller('users')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 🌟 新增：獲取業績結算 (必須放在 :id 路由之前，雖然這裡沒有 :id)
  @Get('commissions')
  async getCommissions(@Query('month') month?: string) {
    return this.userService.getCommissions(month);
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @Patch('password')
  async changePassword(@Body() dto: ChangePasswordDto) {
    return this.userService.changePassword(dto);
  }

  @Get('settings')
  async getMySettings() {
    return this.userService.getMySettings();
  }

  @Patch('settings')
  async updateMySettings(@Body() dto: UpdateUserSettingsDto) {
    return this.userService.updateMySettings(dto);
  }

  @Get('settings/exchange-rates')
  async getExchangeRates() {
    return this.userService.getExchangeRates();
  }

  @Patch('settings/exchange-rates')
  async updateExchangeRates(@Body() dto: UpdateExchangeRatesDto) {
    return this.userService.updateExchangeRates(dto);
  }

  @Post('settings/exchange-rates/refresh-api')
  async refreshApiExchangeRates() {
    return this.userService.refreshApiExchangeRates();
  }
}