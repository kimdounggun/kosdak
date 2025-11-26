import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiReport, AiReportSchema } from '../../schemas/ai-report.schema';
import { CandlesModule } from '../candles/candles.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { SymbolsModule } from '../symbols/symbols.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AiReport.name, schema: AiReportSchema }]),
    CandlesModule,
    IndicatorsModule,
    SymbolsModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}



