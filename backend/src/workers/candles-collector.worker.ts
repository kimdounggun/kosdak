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

      // 로고 URL 가져오기
      // 잘못된 URL 패턴 체크 (C200x200 또는 img1.daumcdn.net/thumb 포함)
      const hasInvalidUrl = symbol.logoUrl && (
        symbol.logoUrl.includes('C200x200') || 
        symbol.logoUrl.includes('img1.daumcdn.net/thumb') ||
        symbol.logoUrl.includes('finance/company') ||
        symbol.logoUrl.includes('finance/logo') // 다음 DAUM 로고 URL도 404가 많아서 제거
      );
      
      // 잘못된 URL 패턴이면 null로 설정 (프론트엔드에서 fallback 아이콘 사용)
      if (hasInvalidUrl) {
        try {
          await this.symbolsService.updateLogoUrl(symbol._id.toString(), null);
          this.logger.log(`✅ Removed invalid logo URL for ${symbol.name} (${symbol.code}) - will use fallback icon`);
        } catch (error) {
          this.logger.warn(`Failed to remove invalid logo for ${symbol.code}: ${error.message}`);
        }
      }
      
      // 참고: 한국 주식 로고는 Yahoo Finance에서 제공하지 않으며,
      // 다음 DAUM 로고 URL도 많은 종목에서 404를 반환합니다.
      // 따라서 로고 URL은 null로 두고, 프론트엔드에서 종목명 첫 글자로 fallback 아이콘을 표시합니다.

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

