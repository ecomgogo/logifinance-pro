import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { ChargeModule } from '../charge/charge.module';
import { LogisticsProviderModule } from '../logistics-provider/logistics-provider.module';
import { DhlClient } from './providers/dhl.client';
import { FedexClient } from './providers/fedex.client';
import { UpsClient } from './providers/ups.client';
import { IntegrationRetryWorker } from './integration-retry.worker';

@Module({
  imports: [ChargeModule, LogisticsProviderModule],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    DhlClient,
    FedexClient,
    UpsClient,
    IntegrationRetryWorker,
  ],
})
export class IntegrationModule {}