import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  onModuleInit() {
    // 預設連線至本機 Redis，正式上線應替換為 process.env.REDIS_URL
    this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    this.redisClient.on('connect', () => {
      console.log('🟢 Redis 連線成功');
    });
    this.redisClient.on('error', (err) => {
      console.error('🔴 Redis 連線失敗:', err);
    });
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  // 🌟 1. 基礎的快取 Get/Set (支援 TTL 過期時間，單位：秒)
  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redisClient.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  // 🌟 2. 輕量級分散式限流器 (Rate Limiter)
  // 例如：限制某個 IP 或 API Key 在 60 秒內只能呼叫 100 次
  async checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
    const current = await this.redisClient.incr(key);
    // 如果是第一次呼叫，設定該 Key 的過期時間
    if (current === 1) {
      await this.redisClient.expire(key, windowSec);
    }
    // 回傳是否「未超過」限制
    return current <= limit;
  }
}