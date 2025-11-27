import { Module } from '@nestjs/common';
import { CandlesModule } from '../modules/candles/candles.module';
import { IndicatorsModule } from '../modules/indicators/indicators.module';
import { SymbolsModule } from '../modules/symbols/symbols.module';
import { AlertsModule } from '../modules/alerts/alerts.module';
import { AiModule } from '../modules/ai/ai.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { CandlesCollectorWorker } from './candles-collector.worker';
import { AlertCheckerWorker } from './alert-checker.worker';
import { AiReportWorker } from './ai-report.worker';
import { WorkersController } from './workers.controller';

@Module({
  imports: [
    CandlesModule,
    IndicatorsModule,
    SymbolsModule,
    AlertsModule,
    AiModule,
    NotificationsModule,
  ],
  controllers: [WorkersController],
  providers: [CandlesCollectorWorker, AlertCheckerWorker, AiReportWorker],
})
export class WorkersModule { }




