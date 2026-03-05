import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { IntegrationService } from './integration.service';

@Injectable()
export class IntegrationRetryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationRetryWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly integrationService: IntegrationService) {}

  onModuleInit(): void {
    const enabled = process.env.WEBHOOK_RETRY_WORKER_ENABLED !== 'false';
    if (!enabled) {
      this.logger.warn('Webhook retry worker 已停用（WEBHOOK_RETRY_WORKER_ENABLED=false）');
      return;
    }

    const intervalMs = this.getEnvNumber('WEBHOOK_RETRY_INTERVAL_MS', 15000);
    const batchSize = this.getEnvNumber('WEBHOOK_RETRY_BATCH_SIZE', 10);

    this.timer = setInterval(async () => {
      if (this.isRunning) {
        return;
      }
      this.isRunning = true;
      try {
        const result = await this.integrationService.processRetryQueue(batchSize);
        if (result.processed.length > 0) {
          this.logger.log(
            `Webhook retry worker 已處理 ${result.processed.length} 筆，queue=${result.queueLength} dead=${result.deadLetterLength}`,
          );
        }
      } catch (error) {
        this.logger.error(`Webhook retry worker 執行失敗：${String(error)}`);
      } finally {
        this.isRunning = false;
      }
    }, intervalMs);

    this.logger.log(
      `Webhook retry worker 已啟動（interval=${intervalMs}ms, batch=${batchSize}）`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private getEnvNumber(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
