import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule：提供具 Supabase RLS 支援的 PrismaService。
 *
 * - 標記為 @Global()，匯入一次後全應用可注入 PrismaService，其他業務模組無須重複引入。
 * - PrismaService 依賴 ClsService（由 AppModule 引入的 ClsModule 提供）取得當前請求的 tenant_id，
 *   並在每次查詢前以 SET LOCAL app.current_tenant_id 配合 PostgreSQL RLS。
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
