import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantMiddleware } from './tenant.middleware';

/** JWT 驗證用 Secret（暫寫死，後續改為 process.env） */
const JWT_SECRET = 'dev-super-secret-key';

/**
 * AuthModule：提供認證與租戶上下文。
 *
 * - 註冊全域 TenantMiddleware：從 Authorization: Bearer <token> 解析 JWT，
 *   將 payload.tenantId 寫入 ClsService，供 PrismaService RLS 使用。
 * - 依賴 JwtModule（@nestjs/jwt）進行 Token 驗證，設為 global 供其他模組注入 JwtService。
 * - 依賴 ClsModule（由 AppModule 以 forRoot + middleware 註冊），TenantMiddleware 會寫入 tenant_id。
 */
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [TenantMiddleware],
  exports: [JwtModule],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
