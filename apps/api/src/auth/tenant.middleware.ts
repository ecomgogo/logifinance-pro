import { Injectable, NestMiddleware } from '@nestjs/common';
import {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import { ClsService } from 'nestjs-cls';
import { JwtService } from '@nestjs/jwt';

/** ClsService 內存放當前請求租戶 ID 的 key（與 PrismaService RLS 一致） */
const CLS_TENANT_ID_KEY = 'tenant_id';

/** JWT Payload 中租戶 ID 的型別（與發票端約定一致） */
export interface JwtPayloadWithTenant {
  /** 租戶 ID，供 RLS 與多租戶隔離使用 */
  tenantId: string;
  sub?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

/** Authorization Header 中 Bearer 前綴 */
const BEARER_PREFIX = 'Bearer ';

/**
 * TenantMiddleware：從請求 Header 的 Authorization: Bearer <token> 解析 JWT，
 * 並將 payload.tenantId 寫入 ClsService，供後續 PrismaService RLS 使用。
 *
 * - 若有 Token 且驗證成功：clsService.set('tenant_id', payload.tenantId)，再 next()。
 * - 若無 Token 或驗證失敗：不拋錯，直接 next()，以支援登入／公開 API。
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly clsService: ClsService,
    private readonly jwtService: JwtService,
  ) {}

  use: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (
      typeof authHeader !== 'string' ||
      !authHeader.startsWith(BEARER_PREFIX)
    ) {
      return next();
    }

    const token = authHeader.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      return next();
    }

    try {
      const payload =
        this.jwtService.verify<JwtPayloadWithTenant>(token);
      
      const tenantId = payload?.tenantId;
      if (typeof tenantId === 'string' && tenantId.length > 0) {
        this.clsService.set(CLS_TENANT_ID_KEY, tenantId);
      }
      
      const userId = payload?.sub;
      if (typeof userId === 'string' && userId.length > 0) {
        this.clsService.set('user_id', userId);
      }

      // 🌟 補上解析並寫入 user_role 的邏輯
      const userRole = payload?.role;
      if (typeof userRole === 'string' && userRole.length > 0) {
        this.clsService.set('user_role', userRole);
      }
    } catch {
      // Token 無效或過期：不拋錯，讓請求繼續（登入／公開 API 不需 Token）
    }

    next();
  };
}
