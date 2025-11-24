import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CandlesService } from '../modules/candles/candles.service';
import { IndicatorsService } from '../modules/indicators/indicators.service';
import { SymbolsService } from '../modules/symbols/symbols.service';

@Injectable()
export class CandlesCollectorWorker {
  private readonly logger = new Logger(CandlesCollectorWorker.name);

  constructor(
    private candlesService: CandlesService,
    private indicatorsService: IndicatorsService,
    private symbolsService: SymbolsService,
    private configService: ConfigService,
  ) {}

  // Run every 5 minutes
  @Cron('*/5 * * * *')
  async collectDelayedQuotes() {
    this.logger.log('Starting delayed quote collection...');

    try {
      const activeSymbols = await this.symbolsService.getActiveSymbols();
      this.logger.log(`Found ${activeSymbols.length} active symbols`);

      for (const symbol of activeSymbols) {
        try {
          await this.collectSymbolData(symbol);
        } catch (error) {
          this.logger.error(
            `Error collecting data for ${symbol.code}: ${error.message}`,
          );
        }
      }

      this.logger.log('Delayed quote collection completed');
    } catch (error) {
      this.logger.error(`Collection error: ${error.message}`);
    }
  }

  private async collectSymbolData(symbol: any) {
    try {
      // Yahoo Finance 티커 형식: 한국 주식은 .KS (KOSPI) 또는 .KQ (KOSDAQ)
      const yahooTicker = symbol.code + (symbol.market === 'KOSPI' ? '.KS' : '.KQ');
      
      this.logger.debug(`Fetching data for ${yahooTicker}`);

      // Yahoo Finance Query API 직접 호출
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`;
      const response = await axios.get(url, {
        params: {
          interval: '5m',
          range: '1d',
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const result = response.data?.chart?.result?.[0];
      if (!result || !result.meta || !result.meta.regularMarketPrice) {
        this.logger.warn(`No data received for ${yahooTicker}`);
        return;
      }

      const meta = result.meta;
      const now = new Date();
      
      // 현재가 정보
      const price = meta.regularMarketPrice;
      const open = meta.regularMarketOpen || meta.previousClose || price;
      const high = meta.regularMarketDayHigh || price;
      const low = meta.regularMarketDayLow || price;
      const volume = meta.regularMarketVolume || 0;

      // Save candle data
      const candleData = {
        symbolId: symbol._id,
        timeframe: '5m',
        timestamp: now,
        open,
        high,
        low,
        close: price,
        volume,
        sourceUpdatedAt: new Date(),
        isDelayed: true,
        delayMinutes: 20,
      };

      await this.candlesService.upsertCandle(candleData);

      // Calculate and cache indicators
      try {
        await this.indicatorsService.calculateAndCache(
          symbol._id.toString(),
          '5m',
        );
      } catch (error) {
        this.logger.error(
          `Error calculating indicators for ${symbol.code}: ${error.message}`,
        );
      }

      this.logger.log(
        `✅ Updated ${symbol.name} (${yahooTicker}): ${price.toLocaleString()}원`,
      );
    } catch (error) {
      this.logger.error(
        `Error fetching data for ${symbol.code}: ${error.message}`,
      );
    }
  }


  // Manual trigger method (can be called via API or CLI)
  async collectNow() {
    await this.collectDelayedQuotes();
  }
}

