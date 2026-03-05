// apps/api/src/auth/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly cls: ClsService) {}

  canActivate(context: ExecutionContext): boolean {
    // 從 ClsService 取得當前請求的上下文
    const tenantId = this.cls.get('tenant_id');
    const userId = this.cls.get('user_id');

    // 如果這兩個 ID 有任何一個不見了 (代表沒帶 Token 或 Token 無效)
    if (!tenantId || !userId) {
      throw new UnauthorizedException('請先登入或提供有效的授權憑證');
    }

    return true; // 檢查通過，放行請求
  }
}