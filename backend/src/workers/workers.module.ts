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
import { OutcomeTrackerWorker } from './outcome-tracker.worker';
import { AutoAiAnalysisWorker } from './auto-ai-analysis.worker';
import { WorkersController } from './workers.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AiReport, AiReportSchema } from '../schemas/ai-report.schema';
import { Symbol, SymbolSchema } from '../schemas/symbol.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiReport.name, schema: AiReportSchema },
      { name: Symbol.name, schema: SymbolSchema }
    ]),
    CandlesModule,
    IndicatorsModule,
    SymbolsModule,
    AlertsModule,
    AiModule,
    NotificationsModule,
  ],
  controllers: [WorkersController],
  providers: [CandlesCollectorWorker, AlertCheckerWorker, AiReportWorker, OutcomeTrackerWorker, AutoAiAnalysisWorker],
})
export class WorkersModule { }




