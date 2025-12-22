import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Candle, CandleSchema } from '../../schemas/candle.schema';
import { CandlesController } from './candles.controller';
import { CandlesService } from './candles.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Candle.name, schema: CandleSchema }]),
  ],
  controllers: [CandlesController],
  providers: [CandlesService],
  exports: [CandlesService],
})
export class CandlesModule {}



























