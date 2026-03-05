import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaClient } from '../../generated/prisma';

/** 供 RLS 使用的 PostgreSQL session 變數名稱（需與 DB policy 一致） */
const RLS_TENANT_ID_KEY = 'app.current_tenant_id';

interface RequestUserPayload {
  sub?: string;
  tenantId?: string;
  email?: string;
  role?: string;
}

type RequestWithUser = Request & { user?: RequestUserPayload };

/**
 * 全域 Prisma 原生 Client（不帶 request context）。
 * 只負責連線生命週期管理與 raw 操作，不直接承載租戶上下文。
 */
@Injectable()
export class PrismaClientProvider
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * Request-Scoped PrismaService：
 * - 每個 request 建立一個 tenant-scoped Prisma 擴展 client
 * - tenant_id 來源為 AuthGuard 解析後掛在 request.user.tenantId
 * - 查詢前透過 set_config 設定 app.current_tenant_id，以配合 PostgreSQL RLS
 */
@Injectable({ scope: Scope.REQUEST })
export class PrismaService {
  private scopedClient?: PrismaClient;

  constructor(
    private readonly baseClient: PrismaClientProvider,
    @Inject(REQUEST) private readonly request: RequestWithUser,
  ) {}

  /**
   * 取得帶 RLS context 的 client。
   * 使用 lazy 初始化，確保每個 request 僅建立一次 extension 實例。
   */
  get client(): PrismaClient {
    if (!this.scopedClient) {
      this.scopedClient = this.createTenantScopedClient();
    }
    return this.scopedClient;
  }

  /**
   * 取得原生 Prisma client（繞過 RLS）。
   * 僅供登入、註冊、系統任務等特殊場景使用。
   */
  get raw(): PrismaClient {
    return this.baseClient;
  }

  private createTenantScopedClient(): PrismaClient {
    const rawClient = this.baseClient;
    const tenantId = this.request.user?.tenantId;

    return rawClient.$extends({
      name: 'rls-tenant-context',
      query: {
        async $allOperations({ model, args, query }) {
          // Tenant 表本身不套租戶隔離
          if (model === 'Tenant') {
            return query(args);
          }

          const setContextQuery =
            typeof tenantId === 'string' && tenantId.length > 0
              ? rawClient.$executeRawUnsafe(
                  `SELECT set_config($1, $2, true)`,
                  RLS_TENANT_ID_KEY,
                  tenantId,
                )
              : rawClient.$executeRawUnsafe(
                  `SELECT set_config($1, '', true)`,
                  RLS_TENANT_ID_KEY,
                );

          const [, result] = await rawClient.$transaction([
            setContextQuery,
            query(args),
          ]);
          return result as unknown;
        },
      },
    }) as unknown as PrismaClient;
  }
}