import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type JsonLike =
  | null
  | string
  | number
  | boolean
  | Date
  | JsonLike[]
  | { [key: string]: JsonLike };

/**
 * DecimalInterceptor：
 * 將 API Response 中的 Decimal（Prisma.Decimal / decimal.js）統一序列化為字串，
 * 避免前端收到 { d, e, s } 的內部結構物件。
 */
@Injectable()
export class DecimalInterceptor<T> implements NestInterceptor<T, JsonLike> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<JsonLike> {
    return next.handle().pipe(
      map((data) => this.serializeDecimals(data as unknown)),
    );
  }

  /**
   * 深度走訪回傳資料：
   * - Decimal -> string
   * - Array / Object -> 遞迴處理
   * - 其他型別保持原樣
   */
  private serializeDecimals(value: unknown): JsonLike {
    if (value === null || value === undefined) {
      return null;
    }

    if (this.isDecimalLike(value)) {
      return value.toString();
    }

    const current = value as unknown;

    if (current instanceof Date) {
      return current;
    }

    if (Array.isArray(current)) {
      return current.map((item) => this.serializeDecimals(item));
    }

    if (typeof current === 'object') {
      const result: Record<string, JsonLike> = {};
      for (const [key, nested] of Object.entries(
        current as Record<string, unknown>,
      )) {
        result[key] = this.serializeDecimals(nested);
      }
      return result;
    }

    return current as JsonLike;
  }

  /**
   * Decimal.js / Prisma.Decimal 的 duck-typing 判斷。
   * 兩者皆有 toString() 與內部 d/e/s 結構，可安全轉字串。
   */
  private isDecimalLike(value: unknown): value is { toString(): string } {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as {
      d?: unknown;
      e?: unknown;
      s?: unknown;
      toString?: unknown;
    };

    return (
      typeof candidate.toString === 'function' &&
      Array.isArray(candidate.d) &&
      typeof candidate.e === 'number' &&
      typeof candidate.s === 'number'
    );
  }
}
