import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaClient } from '../../generated/prisma';

/** 供 RLS 使用的 PostgreSQL session 變數名稱（需與 DB policy 一致） */
const RLS_TENANT_ID_KEY = 'app.current_tenant_id';

/** ClsService 內存放當前請求租戶 ID 的 key */
const CLS_TENANT_ID_KEY = 'tenant_id';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly rawClient: PrismaClient;

  // 🚨 修正點 1：直接宣告為 PrismaClient，捨棄會變成 unknown 的 ExtendedPrismaClient
  private extendedClient!: PrismaClient;

  constructor(private readonly clsService: ClsService) {
    this.rawClient = new PrismaClient();
  }

  async onModuleInit(): Promise<void> {
    const rawClient = this.rawClient;
    const getTenantId = (): string | undefined =>
      this.clsService.get<string>(CLS_TENANT_ID_KEY);

    // 🚨 修正點 2：在結尾使用 as unknown as PrismaClient 強制轉型
    this.extendedClient = rawClient.$extends({
      name: 'rls-tenant-context',
      query: {
        async $allOperations({ model, args, query }) {
          if (model === 'Tenant') {
            return query(args);
          }

          const tenantId = getTenantId();
          const setContextQuery = tenantId
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
          return result as any; // 避免內部型別推斷報錯
        },
      },
    }) as unknown as PrismaClient;
  }

  async onModuleDestroy(): Promise<void> {
    await this.rawClient.$disconnect();
  }

  // 🚨 修正點 3：回傳標準的 PrismaClient 型別
  get client(): PrismaClient {
    return this.extendedClient;
  }

  get raw(): PrismaClient {
    return this.rawClient;
  }
}