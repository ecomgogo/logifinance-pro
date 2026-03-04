import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { PrismaModule } from './prisma';

/**
 * AppModule：應用根模組，整合多租戶防護網。
 *
 * - 必須先引入 ClsModule.forRoot 並啟用 middleware，AsyncLocalStorage 才能運作，
 *   後續 TenantMiddleware 與 PrismaService RLS 才能取得當前請求的 tenant_id。
 * - AuthModule：註冊 TenantMiddleware，從 JWT 解析 tenant_id 並寫入 CLS。
 * - PrismaModule：提供具 RLS 的 PrismaService，依 CLS 的 tenant_id 設定 DB session。
 */
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
