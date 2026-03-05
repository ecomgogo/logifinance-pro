// apps/api/src/charge/charge.module.ts
import { Module } from '@nestjs/common';
import { ChargeController } from './charge.controller';
import { ChargeService } from './charge.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // 必須引入 PrismaModule 才能操作資料庫
  controllers: [ChargeController],
  providers: [ChargeService],
})
export class ChargeModule {}