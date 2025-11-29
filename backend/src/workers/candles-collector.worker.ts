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

      // 🆕 다양한 timeframe의 데이터 수집
      await this.collectTimeframeData(symbol, yahooTicker, '5m', '1d', 100);   // 5분봉 (1일치)
      await this.collectTimeframeData(symbol, yahooTicker, '1h', '1mo', 200);  // 1시간봉 (1개월치)
      await this.collectTimeframeData(symbol, yahooTicker, '1d', '3mo', 200);  // 일봉 (3개월치)
      await this.collectTimeframeData(symbol, yahooTicker, '1wk', '1y', 100);  // 주봉 (1년치)

      // Symbol 시세 정보 업데이트 (5분봉 데이터 기반)
      await this.updateSymbolMarketData(symbol, yahooTicker);

    } catch (error) {
      this.logger.error(
        `Error fetching data for ${symbol.code}: ${error.message}`,
      );
    }
  }

  /**
   * 특정 timeframe의 캔들 데이터 수집
   */
  private async collectTimeframeData(
    symbol: any,
    yahooTicker: string,
    yahooInterval: string,
    range: string,
    limit: number,
  ) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`;
      const response = await axios.get(url, {
        params: {
          interval: yahooInterval,
          range: range,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const result = response.data?.chart?.result?.[0];
      if (!result || !result.timestamp) {
        this.logger.warn(`No ${yahooInterval} data received for ${yahooTicker}`);
        return;
      }

      const timestamps = result.timestamp;
      const quote = result.indicators?.quote?.[0];

      if (!timestamps || !quote || timestamps.length === 0) {
        return;
      }

      // Timeframe 매핑 (Yahoo -> 시스템)
      const timeframeMap: Record<string, string> = {
        '5m': '5m',
        '1h': '1h',
        '1d': '1d',
        '1wk': '1w',
      };
      const timeframe = timeframeMap[yahooInterval] || yahooInterval;

      // 최근 N개 캔들만 저장
      const candlesToSave = Math.min(timestamps.length, limit);
      let savedCount = 0;

      for (let i = timestamps.length - candlesToSave; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const open = quote.open?.[i];
        const high = quote.high?.[i];
        const low = quote.low?.[i];
        const close = quote.close?.[i];
        const volume = quote.volume?.[i];

        if (ts && close !== null && close !== undefined) {
          const rawTimestamp = new Date(ts * 1000);
          const normalizedTimestamp = new Date(rawTimestamp);
          normalizedTimestamp.setSeconds(0, 0);

          const candleData = {
            symbolId: symbol._id,
            timeframe: timeframe,
            timestamp: normalizedTimestamp,
            open: open !== null && open !== undefined ? open : close,
            high: high !== null && high !== undefined ? high : close,
            low: low !== null && low !== undefined ? low : close,
            close: close,
            volume: volume !== null && volume !== undefined ? volume : 0,
            sourceUpdatedAt: new Date(),
            isDelayed: true,
            delayMinutes: 20,
          };

          await this.candlesService.upsertCandle(candleData);
          savedCount++;
        }
      }

      this.logger.log(
        `✅ ${symbol.name} ${timeframe} 캔들 ${savedCount}개 저장`,
      );

      // 지표 계산 및 캐시
      try {
        await this.indicatorsService.calculateAndCache(
          symbol._id.toString(),
          timeframe,
        );
      } catch (error) {
        this.logger.error(
          `Error calculating ${timeframe} indicators for ${symbol.code}: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to fetch ${yahooInterval} data for ${yahooTicker}: ${error.message}`,
      );
    }
  }

  /**
   * Symbol의 시세 정보 업데이트 (5분봉 기반)
   */
  private async updateSymbolMarketData(symbol: any, yahooTicker: string) {
    try {
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
        this.logger.warn(`No market data received for ${yahooTicker}`);
        return;
      }

      const meta = result.meta;

      // 일봉 데이터에서 당일 시가 가져오기
      let dayOpen = meta.regularMarketOpen;
      try {
        const dailyResponse = await axios.get(url, {
          params: {
            interval: '1d',
            range: '1d',
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 10000,
        });

        const dailyResult = dailyResponse.data?.chart?.result?.[0];
        if (dailyResult?.indicators?.quote?.[0]?.open) {
          const dailyQuote = dailyResult.indicators.quote[0];
          dayOpen = dailyQuote.open[dailyQuote.open.length - 1];
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch daily open for ${yahooTicker}: ${error.message}`);
      }

      // 로고 URL 정리
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

      // 시세 정보 업데이트
      const priceChange = meta.regularMarketPrice - (meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice);
      const priceChangePercent = meta.chartPreviousClose
        ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100)
        : 0;

      await this.symbolsService.updateMarketData(symbol._id.toString(), {
        currentPrice: meta.regularMarketPrice,
        dayHigh: meta.regularMarketDayHigh,
        dayLow: meta.regularMarketDayLow,
        dayOpen: dayOpen,
        previousClose: meta.chartPreviousClose || meta.previousClose,
        priceChange: priceChange,
        priceChangePercent: priceChangePercent,
        volume: meta.regularMarketVolume,
        lastUpdated: new Date(),
      });

      this.logger.log(`📈 ${symbol.name} 시세 업데이트: ${meta.regularMarketPrice?.toLocaleString()}원`);
    } catch (error) {
      this.logger.warn(`Failed to update market data for ${yahooTicker}: ${error.message}`);
    }
  }


  // Manual trigger method (can be called via API or CLI)
  async collectNow() {
    await this.collectDelayedQuotes();
  }
}

