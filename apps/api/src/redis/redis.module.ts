import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global() // 🌟 設為 Global，這樣其他模組不用 import 也能直接注入 RedisService
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}