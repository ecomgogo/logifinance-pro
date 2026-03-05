import { Controller, Post, Get, Param, Body, UploadedFile, UseInterceptors, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IntegrationService } from './integration.service';
import { RedisService } from '../redis/redis.service';

@Controller('integration')
export class IntegrationController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly redisService: RedisService // 注入 Redis 進行防刷
  ) {}
  
  // =================================================================
  // 🌟 Milestone 4: Python AI 解析服務
  // =================================================================
  @Post('parse-doc')
  @UseInterceptors(FileInterceptor('file'))
  async parseDoc(@UploadedFile() file: any) { 
    const formData = new (globalThis as any).FormData();
    const blob = new (globalThis as any).Blob([file.buffer], { type: file.mimetype });
    formData.append('file', blob, file.originalname);

    try {
      const response = await fetch('http://127.0.0.1:8000/parse', {
        method: 'POST',
        body: formData,
      });
      return await response.json();
    } catch (error) {
      return { error: '無法連線至 Python 解析服務，請確認 FastAPI 是否啟動在 Port 8000' };
    }
  }

  // =================================================================
  // 🌟 Milestone 6: Webhook 接收與 Rate Limiting 防刷
  // =================================================================
  @Post('webhook/logistics')
  async receiveLogisticsWebhook(
    @Body() payload: any, 
    @Headers('x-api-key') apiKey: string,
    @Headers('x-forwarded-for') ip: string = 'unknown_ip'
  ) {
    // 🛡️ 1. 基礎驗證
    if (apiKey !== 'my-secret-webhook-key') {
      throw new HttpException('Invalid API Key', HttpStatus.UNAUTHORIZED);
    }

    // 🛡️ 2. Redis 限流防護：同一個 IP，1 分鐘內最多只能打 60 次 Webhook
    const rateLimitKey = `ratelimit:webhook:${ip}`;
    const isAllowed = await this.redisService.checkRateLimit(rateLimitKey, 60, 60);
    
    if (!isAllowed) {
      console.warn(`🚨 偵測到異常流量！IP: ${ip} 已被限流`);
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 3. 處理業務邏輯 (寫入資料庫)
    console.log('📦 成功接收物流狀態更新 Webhook:', payload);
    
    return { status: 'success', message: 'Webhook received successfully' };
  }

  // =================================================================
  // 🌟 外部查詢介面 (供前端或系統內部呼叫)
  // =================================================================
  
  @Get('tracking/:mblNumber')
  async getTracking(@Param('mblNumber') mblNumber: string) {
    return this.integrationService.getTrackingInfo(mblNumber);
  }

  @Get('exchange-rate/:currency')
  async getExchangeRate(@Param('currency') currency: string) {
    const rate = await this.integrationService.getExchangeRate(currency);
    return { currency, rate };
  }
}