import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IndicatorCache, IndicatorCacheSchema } from '../../schemas/indicator-cache.schema';
import { CandlesModule } from '../candles/candles.module';
import { IndicatorsController } from './indicators.controller';
import { IndicatorsService } from './indicators.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IndicatorCache.name, schema: IndicatorCacheSchema },
    ]),
    CandlesModule,
  ],
  controllers: [IndicatorsController],
  providers: [IndicatorsService],
  exports: [IndicatorsService],
})
export class IndicatorsModule {}
























