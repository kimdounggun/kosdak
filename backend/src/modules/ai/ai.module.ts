import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiReport, AiReportSchema } from '../../schemas/ai-report.schema';
import { CandlesModule } from '../candles/candles.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { SymbolsModule } from '../symbols/symbols.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { StrategyGenerator } from './services/strategy-generator';
import { MonitoringService } from './services/monitoring.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AiReport.name, schema: AiReportSchema }]),
    CandlesModule,
    IndicatorsModule,
    SymbolsModule,
  ],
  controllers: [AiController],
  providers: [AiService, StrategyGenerator, MonitoringService],
  exports: [AiService],
})
export class AiModule {}








