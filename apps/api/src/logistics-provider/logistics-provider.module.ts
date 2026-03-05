import { Module } from '@nestjs/common';
import { LogisticsProviderController } from './logistics-provider.controller';
import { LogisticsProviderService } from './logistics-provider.service';

@Module({
  controllers: [LogisticsProviderController],
  providers: [LogisticsProviderService],
  exports: [LogisticsProviderService],
})
export class LogisticsProviderModule {}
