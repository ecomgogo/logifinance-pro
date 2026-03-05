import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth';
import { IntegrationService } from './integration.service';
import { ClsService } from 'nestjs-cls';
import { Request } from 'express';
import {
  LogisticsWebhookHeadersDto,
  UpsertLogttCredentialDto,
} from './integration.dto';

interface UploadedFilePayload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

@Controller('integration')
export class IntegrationController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly clsService: ClsService,
  ) {}
  
  // =================================================================
  // 🌟 Milestone 4: Python AI 解析服務
  // =================================================================
  @Post('parse-doc')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async parseDoc(@UploadedFile() file: UploadedFilePayload) {
    return this.integrationService.parseDocument(file);
  }

  @Post('logtt/credentials')
  @UseGuards(AuthGuard)
  async upsertLogttCredentials(@Body() dto: UpsertLogttCredentialDto) {
    return this.integrationService.upsertLogttCredential(dto);
  }

  @Post('webhook/logistics')
  async receiveLogisticsWebhook(
    @Req() req: Request & { rawBody?: Buffer; user?: { tenantId?: string; sub?: string } },
    @Body() payload: Record<string, unknown>,
    @Headers('datatype') datatype: LogisticsWebhookHeadersDto['datatype'],
    @Headers('sign') sign: string,
    @Headers('timestamp') timestamp: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    // Webhook 無 JWT，改以租戶 Header + 簽名驗證建立租戶上下文。
    req.user = { tenantId, sub: 'system-logtt-webhook' };
    this.clsService.set('tenant_id', tenantId);
    this.clsService.set('user_id', 'system-logtt-webhook');

    const rawBody =
      req.rawBody instanceof Buffer
        ? req.rawBody.toString('utf8')
        : JSON.stringify(payload);

    try {
      return this.integrationService.handleLogisticsWebhook({
        headers: { datatype, sign, timestamp },
        payload,
        rawBody,
      });
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() >= 400 &&
        error.getStatus() < 500
      ) {
        throw error;
      }

      await this.integrationService.enqueueWebhookRetry({
        source: 'LOGTT',
        tenantId,
        providerCode: 'LOGTT',
        payload,
        rawBody,
        headers: { datatype, sign, timestamp },
      });
      return { status: 'queued', message: 'Webhook 已排入重試佇列' };
    }
  }

  @Post('webhook/providers/:providerCode/fee')
  async receiveProviderFeeWebhook(
    @Req() req: Request & { rawBody?: Buffer; user?: { tenantId?: string; sub?: string } },
    @Param('providerCode') providerCode: string,
    @Body() payload: Record<string, unknown>,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-signature') signature?: string,
    @Headers('x-timestamp') timestamp?: string,
  ) {
    req.user = { tenantId, sub: 'system-provider-webhook' };
    this.clsService.set('tenant_id', tenantId);
    this.clsService.set('user_id', 'system-provider-webhook');

    const rawBody =
      req.rawBody instanceof Buffer
        ? req.rawBody.toString('utf8')
        : JSON.stringify(payload);

    try {
      return this.integrationService.handleProviderFeeWebhook({
        providerCode,
        payload,
        rawBody,
        signature,
        timestamp,
      });
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() >= 400 &&
        error.getStatus() < 500
      ) {
        throw error;
      }

      await this.integrationService.enqueueWebhookRetry({
        source: 'PROVIDER',
        tenantId,
        providerCode,
        payload,
        rawBody,
        signature,
        timestamp,
      });
      return { status: 'queued', message: 'Webhook 已排入重試佇列' };
    }
  }

  @Post('webhook/retry/process')
  @UseGuards(AuthGuard)
  async processRetryQueue() {
    return this.integrationService.processRetryQueue(10);
  }

  @Get('webhook/retry/dead-letter')
  @UseGuards(AuthGuard)
  async getDeadLetterQueue(
    @Query('providerCode') providerCode?: string,
    @Query('source') source?: 'LOGTT' | 'PROVIDER',
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : 100;
    return this.integrationService.getDeadLetterItems(limit, {
      providerCode,
      source,
    });
  }

  @Get('webhook/retry/stats')
  @UseGuards(AuthGuard)
  async getRetryStats() {
    return this.integrationService.getRetryQueueStats();
  }

  @Post('webhook/retry/dead-letter/:jobId/requeue')
  @UseGuards(AuthGuard)
  async requeueDeadLetterJob(@Param('jobId') jobId: string) {
    return this.integrationService.requeueDeadLetterJob(jobId);
  }

  @Post('webhook/retry/dead-letter/requeue-batch')
  @UseGuards(AuthGuard)
  async requeueDeadLetterBatch(
    @Body()
    body: {
      providerCode?: string;
      source?: 'LOGTT' | 'PROVIDER';
      limit?: number;
    },
  ) {
    return this.integrationService.requeueDeadLetterBatch(body);
  }

  // =================================================================
  // 🌟 外部查詢介面 (供前端或系統內部呼叫)
  // =================================================================
  
  @Get('tracking/:mblNumber')
  @UseGuards(AuthGuard)
  async getTracking(@Param('mblNumber') mblNumber: string) {
    return this.integrationService.getTrackingInfo(mblNumber);
  }

  @Get('providers/:providerCode/tracking/:trackingNumber')
  @UseGuards(AuthGuard)
  async getProviderTracking(
    @Param('providerCode') providerCode: string,
    @Param('trackingNumber') trackingNumber: string,
  ) {
    return this.integrationService.getProviderTrackingInfo(
      providerCode,
      trackingNumber,
    );
  }

  @Get('exchange-rate/:currency')
  @UseGuards(AuthGuard)
  async getExchangeRate(@Param('currency') currency: string) {
    const rate = await this.integrationService.getExchangeRate(currency);
    return { currency, rate };
  }
}