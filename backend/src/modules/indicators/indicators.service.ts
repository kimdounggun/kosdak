import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IndicatorCache, IndicatorCacheDocument } from '../../schemas/indicator-cache.schema';
import { CandlesService } from '../candles/candles.service';
import * as TI from 'technicalindicators';

@Injectable()
export class IndicatorsService {
  constructor(
    @InjectModel(IndicatorCache.name)
    private indicatorCacheModel: Model<IndicatorCacheDocument>,
    private candlesService: CandlesService,
  ) {}

  async calculateAndCache(symbolId: string, timeframe: string) {
    const candles = await this.candlesService.findBySymbol(symbolId, timeframe, 200);
    
    if (candles.length < 20) {
      return; // Not enough data
    }

    // Sort by timestamp ascending for indicator calculation
    candles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    // Calculate RSI
    const rsiValues = TI.RSI.calculate({ values: closes, period: 14 });

    // Calculate MACD
    const macdValues = TI.MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    // Calculate SMA
    const sma5 = TI.SMA.calculate({ values: closes, period: 5 });
    const sma20 = TI.SMA.calculate({ values: closes, period: 20 });
    const sma60 = TI.SMA.calculate({ values: closes, period: 60 });
    const sma120 = TI.SMA.calculate({ values: closes, period: 120 });

    // Calculate Bollinger Bands
    const bbValues = TI.BollingerBands.calculate({
      values: closes,
      period: 20,
      stdDev: 2,
    });

    // Calculate Stochastic
    const stochValues = TI.Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
      signalPeriod: 3,
    });

    // Volume MA
    const volumeMA = TI.SMA.calculate({ values: volumes, period: 20 });

    // Save indicators for each candle
    const indicators = [];
    for (let i = 0; i < candles.length; i++) {
      const indicator: any = {
        symbolId: new Types.ObjectId(symbolId),
        timeframe,
        timestamp: candles[i].timestamp,
      };

      const rsiIndex = i - (candles.length - rsiValues.length);
      if (rsiIndex >= 0) indicator.rsi = rsiValues[rsiIndex];

      const macdIndex = i - (candles.length - macdValues.length);
      if (macdIndex >= 0) {
        indicator.macd = macdValues[macdIndex].MACD;
        indicator.macdSignal = macdValues[macdIndex].signal;
        indicator.macdHist = macdValues[macdIndex].histogram;
      }

      const sma5Index = i - (candles.length - sma5.length);
      if (sma5Index >= 0) indicator.ma5 = sma5[sma5Index];

      const sma20Index = i - (candles.length - sma20.length);
      if (sma20Index >= 0) indicator.ma20 = sma20[sma20Index];

      const sma60Index = i - (candles.length - sma60.length);
      if (sma60Index >= 0) indicator.ma60 = sma60[sma60Index];

      const sma120Index = i - (candles.length - sma120.length);
      if (sma120Index >= 0) indicator.ma120 = sma120[sma120Index];

      const bbIndex = i - (candles.length - bbValues.length);
      if (bbIndex >= 0) {
        indicator.bbUpper = bbValues[bbIndex].upper;
        indicator.bbMiddle = bbValues[bbIndex].middle;
        indicator.bbLower = bbValues[bbIndex].lower;
      }

      const stochIndex = i - (candles.length - stochValues.length);
      if (stochIndex >= 0) {
        indicator.stochK = stochValues[stochIndex].k;
        indicator.stochD = stochValues[stochIndex].d;
      }

      const volumeMAIndex = i - (candles.length - volumeMA.length);
      if (volumeMAIndex >= 0) {
        indicator.volumeMA = volumeMA[volumeMAIndex];
        indicator.volumeRatio = candles[i].volume / volumeMA[volumeMAIndex];
      }

      indicators.push(indicator);
    }

    // Bulk upsert
    const bulkOps = indicators.map(ind => ({
      updateOne: {
        filter: {
          symbolId: ind.symbolId,
          timeframe: ind.timeframe,
          timestamp: ind.timestamp,
        },
        update: { $set: ind },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await this.indicatorCacheModel.bulkWrite(bulkOps);
    }
  }

  async getLatest(symbolId: string, timeframe: string): Promise<IndicatorCacheDocument | null> {
    return this.indicatorCacheModel
      .findOne({
        symbolId: new Types.ObjectId(symbolId),
        timeframe,
      })
      .sort({ timestamp: -1 });
  }

  async findBySymbol(
    symbolId: string,
    timeframe: string,
    limit: number = 200,
  ): Promise<IndicatorCacheDocument[]> {
    return this.indicatorCacheModel
      .find({
        symbolId: new Types.ObjectId(symbolId),
        timeframe,
      })
      .sort({ timestamp: -1 })
      .limit(limit);
  }
}

