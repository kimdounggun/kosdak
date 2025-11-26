import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CandlesService } from '../modules/candles/candles.service';
import { IndicatorsService } from '../modules/indicators/indicators.service';
import { SymbolsService } from '../modules/symbols/symbols.service';

@Injectable()
export class CandlesCollectorWorker implements OnModuleInit {
  private readonly logger = new Logger(CandlesCollectorWorker.name);

  constructor(
    private candlesService: CandlesService,
    private indicatorsService: IndicatorsService,
    private symbolsService: SymbolsService,
    private configService: ConfigService,
  ) {}

  // 서버 시작 시 즉시 실행
  async onModuleInit() {
    this.logger.log('🚀 Worker initialized, starting initial data collection...');
    // 약간의 지연 후 실행 (모든 모듈이 완전히 초기화된 후)
    setTimeout(() => {
      this.collectDelayedQuotes();
    }, 5000); // 5초 후 실행
  }

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

      // Yahoo Finance Query API 직접 호출 - 5일치 5분봉 데이터 가져오기
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`;
      const response = await axios.get(url, {
        params: {
          interval: '5m',
          range: '5d', // 5일치 데이터로 변경 (더 많은 캔들)
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
      
      // 로고 URL 가져오기
      // 잘못된 URL 패턴 체크 (C200x200 또는 img1.daumcdn.net/thumb 포함)
      const hasInvalidUrl = symbol.logoUrl && (
        symbol.logoUrl.includes('C200x200') || 
        symbol.logoUrl.includes('img1.daumcdn.net/thumb') ||
        symbol.logoUrl.includes('finance/company') ||
        symbol.logoUrl.includes('finance/logo')
      );
      
      if (hasInvalidUrl) {
        try {
          await this.symbolsService.updateLogoUrl(symbol._id.toString(), null);
          this.logger.log(`✅ Removed invalid logo URL for ${symbol.name} (${symbol.code})`);
        } catch (error) {
          this.logger.warn(`Failed to remove invalid logo for ${symbol.code}: ${error.message}`);
        }
      }

      // 실제 5분봉 시계열 데이터 파싱
      const timestamps = result.timestamp;
      const quote = result.indicators?.quote?.[0];
      
      if (timestamps && quote && timestamps.length > 0) {
        // 실제 5분봉 데이터 저장 (최근 100개만)
        const candlesToSave = Math.min(timestamps.length, 100);
        let savedCount = 0;
        
        for (let i = timestamps.length - candlesToSave; i < timestamps.length; i++) {
          const ts = timestamps[i];
          const open = quote.open?.[i];
          const high = quote.high?.[i];
          const low = quote.low?.[i];
          const close = quote.close?.[i];
          const volume = quote.volume?.[i];
          
          // null 값이 아닌 경우에만 저장
          if (ts && close !== null && close !== undefined) {
            const candleData = {
              symbolId: symbol._id,
              timeframe: '5m',
              timestamp: new Date(ts * 1000), // Unix timestamp to Date
              open: open || close,
              high: high || close,
              low: low || close,
              close: close,
              volume: volume || 0,
              sourceUpdatedAt: new Date(),
              isDelayed: true,
              delayMinutes: 20,
            };

            await this.candlesService.upsertCandle(candleData);
            savedCount++;
          }
        }
        
        this.logger.log(
          `✅ Updated ${symbol.name} (${yahooTicker}): ${savedCount} candles saved, latest: ${meta.regularMarketPrice?.toLocaleString()}원`,
        );
      } else {
        // Fallback: meta 정보만 있는 경우 현재가로 단일 캔들 저장
        const price = meta.regularMarketPrice;
        const candleData = {
          symbolId: symbol._id,
          timeframe: '5m',
          timestamp: new Date(),
          open: meta.regularMarketOpen || price,
          high: meta.regularMarketDayHigh || price,
          low: meta.regularMarketDayLow || price,
          close: price,
          volume: meta.regularMarketVolume || 0,
          sourceUpdatedAt: new Date(),
          isDelayed: true,
          delayMinutes: 20,
        };

        await this.candlesService.upsertCandle(candleData);
        this.logger.log(
          `✅ Updated ${symbol.name} (${yahooTicker}) [meta only]: ${price.toLocaleString()}원`,
        );
      }

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

