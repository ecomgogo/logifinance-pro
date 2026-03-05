import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;
  private redisAvailable = false;
  private lastRedisErrorLogAt = 0;
  private memoryKv = new Map<string, { value: string; expiresAt?: number }>();
  private memoryLists = new Map<string, string[]>();

  onModuleInit() {
    // 預設連線至本機 Redis，正式上線應替換為 process.env.REDIS_URL
    this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    this.redisClient.on('connect', () => {
      console.log('🟢 Redis 連線成功');
      this.redisAvailable = true;
    });
    this.redisClient.on('error', (err) => {
      const now = Date.now();
      if (now - this.lastRedisErrorLogAt > 60000) {
        console.error('🔴 Redis 連線失敗（已啟用記憶體 fallback）:', err);
        this.lastRedisErrorLogAt = now;
      }
      this.redisAvailable = false;
    });
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }

  // 🌟 1. 基礎的快取 Get/Set (支援 TTL 過期時間，單位：秒)
  async get(key: string): Promise<string | null> {
    if (this.redisAvailable) {
      try {
        return await this.redisClient.get(key);
      } catch {
        this.redisAvailable = false;
      }
    }
    return this.getMemoryValue(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.redisAvailable) {
      try {
        if (ttlSeconds) {
          await this.redisClient.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.redisClient.set(key, value);
        }
        return;
      } catch {
        this.redisAvailable = false;
      }
    }
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.memoryKv.set(key, { value, expiresAt });
  }

  async lpush(key: string, value: string): Promise<number> {
    if (this.redisAvailable) {
      try {
        return await this.redisClient.lpush(key, value);
      } catch {
        this.redisAvailable = false;
      }
    }
    const list = this.memoryLists.get(key) || [];
    list.unshift(value);
    this.memoryLists.set(key, list);
    return list.length;
  }

  async rpush(key: string, value: string): Promise<number> {
    if (this.redisAvailable) {
      try {
        return await this.redisClient.rpush(key, value);
      } catch {
        this.redisAvailable = false;
      }
    }
    const list = this.memoryLists.get(key) || [];
    list.push(value);
    this.memoryLists.set(key, list);
    return list.length;
  }

  async rpop(key: string): Promise<string | null> {
    if (this.redisAvailable) {
      try {
        return await this.redisClient.rpop(key);
      } catch {
        this.redisAvailable = false;
      }
    }
    const list = this.memoryLists.get(key) || [];
    const value = list.pop() ?? null;
    this.memoryLists.set(key, list);
    return value;
  }

  async llen(key: string): Promise<number> {
    if (this.redisAvailable) {
      try {
        return await this.redisClient.llen(key);
      } catch {
        this.redisAvailable = false;
      }
    }
    return (this.memoryLists.get(key) || []).length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (this.redisAvailable) {
      try {
        return await this.redisClient.lrange(key, start, stop);
      } catch {
        this.redisAvailable = false;
      }
    }
    const list = this.memoryLists.get(key) || [];
    const endIdx = stop === -1 ? list.length : stop + 1;
    return list.slice(start, endIdx);
  }

  async del(key: string): Promise<number> {
    if (this.redisAvailable) {
      try {
        return await this.redisClient.del(key);
      } catch {
        this.redisAvailable = false;
      }
    }
    let removed = 0;
    if (this.memoryKv.delete(key)) removed += 1;
    if (this.memoryLists.delete(key)) removed += 1;
    return removed;
  }

  // 🌟 2. 輕量級分散式限流器 (Rate Limiter)
  // 例如：限制某個 IP 或 API Key 在 60 秒內只能呼叫 100 次
  async checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
    if (this.redisAvailable) {
      try {
        const current = await this.redisClient.incr(key);
        // 如果是第一次呼叫，設定該 Key 的過期時間
        if (current === 1) {
          await this.redisClient.expire(key, windowSec);
        }
        // 回傳是否「未超過」限制
        return current <= limit;
      } catch {
        this.redisAvailable = false;
      }
    }

    const now = Date.now();
    const record = this.memoryKv.get(key);
    const expiresAt = now + windowSec * 1000;
    if (!record || (record.expiresAt && record.expiresAt <= now)) {
      this.memoryKv.set(key, { value: '1', expiresAt });
      return true;
    }
    const next = Number(record.value || '0') + 1;
    this.memoryKv.set(key, { value: String(next), expiresAt: record.expiresAt });
    return next <= limit;
  }

  private getMemoryValue(key: string): string | null {
    const entry = this.memoryKv.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.memoryKv.delete(key);
      return null;
    }
    return entry.value;
  }
}