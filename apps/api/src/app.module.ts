import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { PrismaModule } from './prisma';
import { ShipmentModule } from './shipment/shipment.module';
import { ChargeModule } from './charge/charge.module';
import { SettlementModule } from './settlement/settlement.module';
import { PartnerModule } from './partner/partner.module';
import { DashboardModule } from './dashboard/dashboard.module'; // 🌟 引入新的模組

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    PrismaModule,
    AuthModule,
    ShipmentModule,
    ChargeModule,
    SettlementModule,
    PartnerModule,
    DashboardModule, // 🌟 註冊
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}