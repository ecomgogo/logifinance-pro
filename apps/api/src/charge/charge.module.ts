// apps/api/src/charge/charge.module.ts
import { Module } from '@nestjs/common';
import { ChargeController } from './charge.controller';
import { ChargeService } from './charge.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule], // 必須引入 PrismaModule 才能操作資料庫
  controllers: [ChargeController],
  providers: [ChargeService],
  exports: [ChargeService],
})
export class ChargeModule {}