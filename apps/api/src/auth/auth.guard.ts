import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import type { Request } from 'express';

/** Authorization Header 中 Bearer 前綴 */
const BEARER_PREFIX = 'Bearer ';

/** AuthGuard 解析後掛載到 request.user 的 JWT payload 型別 */
interface RequestUserPayload {
  sub: string;
  tenantId: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

type RequestWithUser = Request & { user?: RequestUserPayload };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly cls: ClsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;

    if (
      typeof authHeader !== 'string' ||
      !authHeader.startsWith(BEARER_PREFIX)
    ) {
      throw new UnauthorizedException('請先登入');
    }

    const token = authHeader.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      throw new UnauthorizedException('請先登入');
    }

    try {
      const payload = this.jwtService.verify<RequestUserPayload>(token);
      if (
        typeof payload?.tenantId !== 'string' ||
        payload.tenantId.length === 0 ||
        typeof payload?.sub !== 'string' ||
        payload.sub.length === 0
      ) {
        throw new UnauthorizedException('授權資訊不完整');
      }

      // 將解析結果掛到 request.user，供 Request-Scoped PrismaService 使用
      request.user = payload;

      // 同步寫入 CLS，供既有程式碼使用
      this.cls.set('tenant_id', payload.tenantId);
      this.cls.set('user_id', payload.sub);
      if (typeof payload.role === 'string' && payload.role.length > 0) {
        this.cls.set('user_role', payload.role);
      }

      return true;
    } catch {
      throw new UnauthorizedException('請先登入');
    }
  }
}