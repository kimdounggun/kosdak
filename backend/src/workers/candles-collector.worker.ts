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

      // Yahoo Finance Query API 직접 호출 (5분봉)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`;
      const response = await axios.get(url, {
        params: {
          interval: '5m',
          range: '1d', // 1일치 (안정적)
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

      // 일봉 데이터 가져오기 (당일 시가를 위해)
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
          // 마지막(오늘) 캔들의 시가
          dayOpen = dailyQuote.open[dailyQuote.open.length - 1];
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch daily data for ${yahooTicker}: ${error.message}`);
      }
      
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

      // ✨ Symbol에 당일 시세 정보 업데이트 (고가/저가/시가 포함)
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

      this.logger.log(`📈 ${symbol.name} 시세 업데이트: 시가 ${dayOpen?.toLocaleString()}원, 현재 ${meta.regularMarketPrice?.toLocaleString()}원, 고가 ${meta.regularMarketDayHigh?.toLocaleString()}원, 저가 ${meta.regularMarketDayLow?.toLocaleString()}원`);

      // 실제 5분봉 시계열 데이터 파싱
      const timestamps = result.timestamp;
      const quote = result.indicators?.quote?.[0];
      
      // 🔍 디버깅: 전체 캔들 중 처음으로 정상적인 OHLC를 가진 캔들 찾기
      if (timestamps && quote && timestamps.length > 0) {
        this.logger.log(`📊 ${symbol.name} - 총 ${timestamps.length}개 캔들 수신`);
        
        // 최신 5개 캔들 확인
        this.logger.log(`  최신 5개 캔들 OHLC:`);
        for (let i = Math.max(0, timestamps.length - 5); i < timestamps.length; i++) {
          this.logger.log(`  [${i}] O:${quote.open?.[i]} H:${quote.high?.[i]} L:${quote.low?.[i]} C:${quote.close?.[i]} V:${quote.volume?.[i]}`);
        }
        
        // 첫 정상 캔들 찾기 (OHLC가 다른 첫 번째 캔들)
        let firstValidIdx = -1;
        for (let i = timestamps.length - 1; i >= 0; i--) {
          const o = quote.open?.[i];
          const h = quote.high?.[i];
          const l = quote.low?.[i];
          const c = quote.close?.[i];
          if (o !== null && h !== null && l !== null && c !== null && !(o === c && h === c && l === c)) {
            firstValidIdx = i;
            break;
          }
        }
        
        if (firstValidIdx >= 0) {
          this.logger.log(`  ✅ 첫 정상 캔들: [${firstValidIdx}] O:${quote.open?.[firstValidIdx]} H:${quote.high?.[firstValidIdx]} L:${quote.low?.[firstValidIdx]} C:${quote.close?.[firstValidIdx]}`);
        } else {
          this.logger.log(`  ❌ 정상 캔들 없음 (모두 null 또는 OHLC 동일)`);
        }
      }
      
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
            // timestamp 정규화 (초, 밀리초 제거 → 5분 단위로 정렬)
            const rawTimestamp = new Date(ts * 1000);
            const normalizedTimestamp = new Date(rawTimestamp);
            normalizedTimestamp.setSeconds(0, 0); // 초와 밀리초를 0으로 설정
            
            const candleData = {
              symbolId: symbol._id,
              timeframe: '5m',
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
          `✅ Updated ${symbol.name} (${yahooTicker}): ${savedCount} candles saved, latest: ${meta.regularMarketPrice?.toLocaleString()}원`,
        );
      } else {
        // Fallback: meta 정보만 있는 경우 현재가로 단일 캔들 저장
        const price = meta.regularMarketPrice;
        
        // timestamp 정규화 (초, 밀리초 제거)
        const now = new Date();
        now.setSeconds(0, 0);
        
        const candleData = {
          symbolId: symbol._id,
          timeframe: '5m',
          timestamp: now,
          open: meta.regularMarketOpen !== null && meta.regularMarketOpen !== undefined ? meta.regularMarketOpen : price,
          high: meta.regularMarketDayHigh !== null && meta.regularMarketDayHigh !== undefined ? meta.regularMarketDayHigh : price,
          low: meta.regularMarketDayLow !== null && meta.regularMarketDayLow !== undefined ? meta.regularMarketDayLow : price,
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

