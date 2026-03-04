import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TenantMiddleware } from './tenant.middleware';

/** JWT 驗證用 Secret（暫寫死，後續改為 process.env） */
const JWT_SECRET = 'dev-super-secret-key';

/**
 * AuthModule：提供認證與租戶上下文。
 *
 * - 註冊全域 TenantMiddleware：從 Authorization: Bearer <token> 解析 JWT，
 *   將 payload.tenantId 寫入 ClsService，供 PrismaService RLS 使用。
 * - 提供 AuthController（POST /auth/register、POST /auth/login）與 AuthService。
 * - 依賴 JwtModule（@nestjs/jwt）、PrismaService（@Global）與 ClsModule（AppModule）。
 */
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TenantMiddleware],
  exports: [JwtModule, AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
