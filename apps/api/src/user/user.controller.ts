import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './user.dto';
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
}