import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaClient } from '../../generated/prisma';

/** 供 RLS 使用的 PostgreSQL  session 變數名稱（需與 DB policy 一致） */
const RLS_TENANT_ID_KEY = 'app.current_tenant_id';

/** ClsService 內存放當前請求租戶 ID 的 key（與 JWT 解析後寫入的 key 一致） */
const CLS_TENANT_ID_KEY = 'tenant_id';

/**
 * 具 RLS 擴充的 Prisma Client 型別。
 * 由 $extends 推斷，對外暴露的 client 一律為已套用 SET LOCAL 的擴充實例。
 */
export type ExtendedPrismaClient = ReturnType<PrismaClient['$extends']>;

/**
 * PrismaService：提供具 Supabase RLS 支援的 Prisma Client。
 *
 * - 實作 OnModuleInit：建立 PrismaClient 並以 $extends 注入「依請求設定 app.current_tenant_id」的邏輯。
 * - 除 Tenant 外，所有模型的查詢與 raw 查詢皆會在執行前於同一連線執行
 *   SET LOCAL app.current_tenant_id = '${tenantId}'（或無 tenant 時清空），以配合 PostgreSQL RLS。
 * - 使用 nestjs-cls 的 ClsService 取得當前請求的 tenant_id；無 tenant_id 時（如背景任務）不設定或 RESET，避免連線池污染。
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  /** 未擴充的 Prisma Client，僅用於 $transaction 與 $extends 的閉包參考 */
  private readonly rawClient: PrismaClient;

  /** 已套用 RLS 擴充的 Client，供業務程式使用 */
  private extendedClient!: ExtendedPrismaClient;

  constructor(private readonly clsService: ClsService) {
    this.rawClient = new PrismaClient();
  }

  async onModuleInit(): Promise<void> {
    const rawClient = this.rawClient;
    const getTenantId = (): string | undefined =>
      this.clsService.get<string>(CLS_TENANT_ID_KEY);

    this.extendedClient = rawClient.$extends({
      name: 'rls-tenant-context',
      query: {
        async $allOperations({ model, args, query }) {
          // 租戶表本身不需隔離，直接執行查詢
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
          return result as Awaited<ReturnType<typeof query>>;
        },
      },
    }) as ExtendedPrismaClient;
  }

  async onModuleDestroy(): Promise<void> {
    await this.rawClient.$disconnect();
  }

  /**
   * 取得已套用 RLS 的 Prisma Client。
   * 所有透過此 client 的查詢（除 Tenant 外）皆會先設定 app.current_tenant_id，以配合 PostgreSQL RLS。
   */
  get client(): ExtendedPrismaClient {
    return this.extendedClient;
  }

  /**
   * 取得未擴充的 Prisma Client。
   * 僅在需繞過 RLS（如系統後台、種子）時使用，一般業務請使用 client。
   */
  get raw(): PrismaClient {
    return this.rawClient;
  }
}
