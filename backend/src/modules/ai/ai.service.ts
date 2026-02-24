import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiReport, AiReportDocument } from '../../schemas/ai-report.schema';
import { CandlesService } from '../candles/candles.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { SymbolsService } from '../symbols/symbols.service';
import { 
  TRADING_STRATEGY_CONFIG, 
  getAdjustedTargets, 
  getFallbackTargets,
  getVolatilityLevel 
} from '../../config/trading-strategy.config';
import { 
  CONFIDENCE_CONFIG, 
  getAdjustedWeights, 
  getMarketCondition 
} from '../../config/confidence.config';
import { getValidUntil } from '../../config/report-validity.config';
import { StrategyGenerator } from './services/strategy-generator';
import { StrategyGenerationContext } from './types/strategy-types';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(
    @InjectModel(AiReport.name) private aiReportModel: Model<AiReportDocument>,
    private candlesService: CandlesService,
    private indicatorsService: IndicatorsService,
    private symbolsService: SymbolsService,
    private configService: ConfigService,
    private strategyGenerator: StrategyGenerator,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * 결과 요약 3줄 (추천 → 이유 → 행동)
   */
  private buildRecommendationSummary(
    predictedAction: string,
    latestCandle: any,
    latestIndicator: any,
    investmentPeriod: string,
    strategy: any,
  ) {
    const currentPrice = latestCandle?.close || 0;
    const rsi = latestIndicator?.rsi;
    const macd = latestIndicator?.macd;
    const macdSignal = latestIndicator?.macdSignal;

    // 전략 기반 추천 문구 (entryRatio와 일관성 유지)
    const phase1 = strategy?.phase1;
    const entryRatio = phase1?.entryRatio ?? 0;

    let recommendation: string;
    if (entryRatio >= 40) {
      recommendation = '강력 매수';
    } else if (entryRatio >= 25) {
      recommendation = '매수';
    } else if (entryRatio > 0) {
      recommendation = '관망 (소량 진입)';
    } else {
      // 전략이 없거나 진입 비율이 0이면 예전 predictedAction 사용
      recommendation = predictedAction || '관망';
    }

    // 이유 요약
    const reasonParts: string[] = [];
    if (rsi !== undefined) {
      reasonParts.push(`RSI ${rsi.toFixed(2)}`);
    }
    if (macd !== undefined && macdSignal !== undefined) {
      const macdDir = macd > macdSignal ? 'MACD 상향돌파' : 'MACD 하향돌파';
      reasonParts.push(macdDir);
    }
    const reason =
      reasonParts.length > 0
        ? reasonParts.join(' · ')
        : '주요 기술적 지표 종합 분석';

    // 행동 요약
    const action = `단기 스윙 (${investmentPeriod === 'swing' ? '3~7일' : investmentPeriod === 'medium' ? '2~4주' : '1~3개월'}) 기준 1일차 ${entryRatio}% 진입 전략 고려 (현재가 ${currentPrice.toLocaleString()}원 기준)`;

    return {
      recommendation,
      reason,
      action,
    };
  }

  /**
   * If-Then 규칙 트리 생성 (조건 → 액션)
   */
  private buildIfThenRules(strategy: any) {
    if (!strategy) return [];

    const rules: any[] = [];

    const phase2 = strategy.phase2 || {};
    const phase3 = strategy.phase3 || {};

    if (phase2.bullish) {
      rules.push({
        phase: '2~3일차',
        scenario: '상승',
        if: phase2.bullish.condition,
        then: phase2.bullish.action,
        type: 'bullish',
      });
    }
    if (phase2.sideways) {
      rules.push({
        phase: '2~3일차',
        scenario: '횡보',
        if: phase2.sideways.condition,
        then: phase2.sideways.action,
        type: 'sideways',
      });
    }
    if (phase2.bearish) {
      rules.push({
        phase: '2~3일차',
        scenario: '하락',
        if: phase2.bearish.condition,
        then: phase2.bearish.action,
        type: 'bearish',
      });
    }

    if (phase3.target1) {
      rules.push({
        phase: '5~7일차',
        scenario: '1차 목표 달성',
        if: phase3.target1.price,
        then: phase3.target1.action,
        type: 'target1',
      });
    }
    if (phase3.target2) {
      rules.push({
        phase: '5~7일차',
        scenario: '2차 목표 달성',
        if: phase3.target2.price,
        then: phase3.target2.action,
        type: 'target2',
      });
    }

    return rules;
  }

  /**
   * 매수 단가 보정 전략(DCA) 예시 생성
   * - 실제 유저 자산 연동 전까지는 대표 예시 자산(100만/1,000만) 기준
   */
  private buildDcaExamples(
    entryPrice: number,
    strategy: any,
    capitalExamples: number[] = [1_000_000, 10_000_000],
  ) {
    const phase1 = strategy?.phase1 || {};
    const entryRatio = phase1.entryRatio ?? 30;

    const examples = capitalExamples.map((capital) => {
      const amount = Math.round((capital * entryRatio) / 100);
      return {
        capital,
        entryAmount: amount,
      };
    });

    return {
      entryRatio,
      examples,
    };
  }

  /**
   * 투자 기간에 따라 최적의 timeframe을 반환
   */
  private getOptimalTimeframe(investmentPeriod: string): string {
    const timeframeMap: Record<string, string> = {
      'swing': '1d',   // 3~7일 단기 스윙 → 일봉
      'medium': '1d',  // 2~4주 중기 → 일봉
      'long': '1w',    // 1~3개월 장기 → 주봉
    };
    
    return timeframeMap[investmentPeriod] || '1d'; // 기본값은 일봉
  }

  async generateReport(
    symbolId: string,
    timeframe?: string,
    reportType: string = 'comprehensive',
    userId?: string,
    investmentPeriod: string = 'swing',
  ): Promise<AiReportDocument> {
    // 🆕 투자 기간에 따라 적절한 timeframe 자동 선택
    if (!timeframe) {
      timeframe = this.getOptimalTimeframe(investmentPeriod);
    }

    // Fetch symbol info
    const symbol = await this.symbolsService.findById(symbolId);

    // Fetch recent candles
    const candles = await this.candlesService.findBySymbol(symbolId, timeframe, 100);
    
    // Fetch indicators
    const indicators = await this.indicatorsService.findBySymbol(symbolId, timeframe, 100);

    if (candles.length === 0) {
      throw new Error('No candle data available for analysis');
    }

    // Prepare data for AI
    const latestCandle = candles[0];
    const latestIndicator = indicators.length > 0 ? indicators[0] : null;

    // 변동성 레벨 계산 (신뢰도 계산과 목표가 계산에 사용)
    const bbWidth = latestIndicator?.bbUpper && latestIndicator?.bbLower && latestCandle
      ? (latestIndicator.bbUpper - latestIndicator.bbLower) / latestCandle.close
      : null;
    const volatilityLevel = getVolatilityLevel(bbWidth);

    // 🆕 과거 유사 패턴 분석 (백테스팅 데이터 활용)
    const historicalContext = await this.getHistoricalContext(symbolId, latestIndicator);

    const prompt = this.buildPrompt(symbol, candles, indicators, reportType, investmentPeriod, historicalContext, volatilityLevel);

    let content = '';
    let metadata: any = {
      priceAtGeneration: latestCandle.close,
      candlesAnalyzed: candles.length,
      model: 'gpt-4',
    };

    if (latestIndicator) {
      metadata.rsiAtGeneration = latestIndicator.rsi;
      metadata.volumeAtGeneration = latestCandle.volume;
      metadata.macd = latestIndicator.macd;
      metadata.macdSignal = latestIndicator.macdSignal;
    }

    // 🆕 과거 패턴 정보 메타데이터에 저장
    if (historicalContext) {
      metadata.historicalPattern = historicalContext;
    }

    // 분석 과정 추적
    const analysisProcess: any = {};
    const explainability: any = {};
    let rawResponse = '';
    const startTime = Date.now();

    // ⚠️ AI 리포트 텍스트 생성 제거 (프론트에서 미사용, 800 토큰 절감)
    // 이제 전략(strategy) 데이터만 생성하고, 텍스트 리포트는 생성하지 않음
    
    if (this.openai) {
      try {
        // Step 1: 기술적 지표 분석 (간소화)
        analysisProcess.step1 = {
          status: 'completed',
          result: '기술적 지표 분석 완료',
          details: {
            rsi: latestIndicator?.rsi || 0,
            macd: latestIndicator?.macd || 0,
            ma20: latestIndicator?.ma20 || 0,
          }
        };

        // Step 2: 패턴 인식 (간소화)
        analysisProcess.step2 = {
          status: 'completed',
          result: '패턴 인식 완료',
          details: this.analyzeTrend(candles)
        };

        // Step 3: 리스크 평가 (간소화)
        analysisProcess.step3 = {
          status: 'completed',
          result: '리스크 평가 완료',
          details: this.assessRisk(candles, latestIndicator)
        };

        // AI 리포트 텍스트는 생성하지 않음 (비용 절감)
        content = '';
        rawResponse = '';
        
        // 메타데이터 업데이트 (AI 리포트 생성 스킵)
        metadata.model = 'gpt-4o-mini';
        metadata.modelVersion = 'gpt-4o-mini-2024-07-18';
        metadata.tokensUsed = 0; // 리포트 텍스트 생성 안 함
        metadata.processingTimeMs = Date.now() - startTime;
        metadata.reportSkipped = true; // 리포트 스킵 플래그

        // 🆕 AI 신뢰도 계산 (설정 파일 기반)
        let confidenceScore = CONFIDENCE_CONFIG.base;
        
        // 시장 상황 판단
        const marketCondition = getMarketCondition(bbWidth || 0);
        const weights = getAdjustedWeights(marketCondition);
        
        // ⭐ 1. 과거 예측 정확도 (설정 파일에서 가중치 로드)
        if (historicalContext && historicalContext.totalCases >= 5) {
          const historicalAccuracy = historicalContext.successRate / 100;
          confidenceScore += historicalAccuracy * weights.historicalAccuracy;
          
          // 샘플 수가 많을수록 신뢰도 증가
          if (historicalContext.totalCases >= CONFIDENCE_CONFIG.thresholds.sampleSize.bonus) {
            confidenceScore += weights.sampleSizeBonus;
          }
        }
        
        // 2. 데이터 품질 (설정 파일에서 가중치 로드)
        if (candles.length >= 100) {
          confidenceScore += weights.dataQuality.high;
        } else if (candles.length >= 50) {
          confidenceScore += weights.dataQuality.medium;
        }
        
        // 3. 지표 일치도 (설정 파일에서 가중치 로드)
        if (latestIndicator) {
          let agreementCount = 0;
          let totalSignals = 0;
          
          // RSI 신호 (설정 파일에서 임계값 로드)
          if (latestIndicator.rsi) {
            totalSignals++;
            if (latestIndicator.rsi > CONFIDENCE_CONFIG.thresholds.rsi.overbought || 
                latestIndicator.rsi < CONFIDENCE_CONFIG.thresholds.rsi.oversold) {
              agreementCount++;
            }
          }
          
          // MACD 신호 (설정 파일에서 임계값 로드)
          if (latestIndicator.macd !== undefined && latestIndicator.macdSignal !== undefined) {
            totalSignals++;
            if (Math.abs(latestIndicator.macd - latestIndicator.macdSignal) > CONFIDENCE_CONFIG.thresholds.macd.significant) {
              agreementCount++;
            }
          }
          
          // 이평선 배열
          if (latestIndicator.ma5 && latestIndicator.ma20 && latestIndicator.ma60) {
            totalSignals++;
            const isAligned = (latestIndicator.ma5 > latestIndicator.ma20 && latestIndicator.ma20 > latestIndicator.ma60) ||
                             (latestIndicator.ma5 < latestIndicator.ma20 && latestIndicator.ma20 < latestIndicator.ma60);
            if (isAligned) {
              agreementCount++;
            }
          }
          
          if (totalSignals > 0) {
            confidenceScore += (agreementCount / totalSignals) * weights.indicatorAgreement;
          }
        }
        
        // 4. 시장 상황 적합성 - 거래량 (설정 파일에서 가중치/임계값 로드)
        if (latestIndicator?.volumeRatio) {
          if (latestIndicator.volumeRatio > CONFIDENCE_CONFIG.thresholds.volume.surge) {
            confidenceScore += weights.volume.surge;
          } else if (latestIndicator.volumeRatio > CONFIDENCE_CONFIG.thresholds.volume.increase) {
            confidenceScore += weights.volume.increase;
          }
        }
        
        // 5. 변동성 패널티 (설정 파일에서 가중치/임계값 로드)
        if (bbWidth !== null) {
          if (bbWidth > CONFIDENCE_CONFIG.thresholds.volatility.high) {
            confidenceScore -= weights.volatility.high;
          } else if (bbWidth > CONFIDENCE_CONFIG.thresholds.volatility.medium) {
            confidenceScore -= weights.volatility.medium;
          }
        }
        
        // 최종 신뢰도 (설정 파일에서 범위 로드)
        metadata.confidence = Math.min(
          CONFIDENCE_CONFIG.bounds.max, 
          Math.max(CONFIDENCE_CONFIG.bounds.min, confidenceScore)
        );

        // 가중치 계산
        explainability.factors = this.calculateFactorWeights(latestIndicator, candles);
        explainability.reasoning = this.generateReasoning(latestIndicator, candles);
        explainability.alternatives = this.generateAlternatives(latestIndicator);
        
        // AI 리포트 검증 스킵 (텍스트 생성 안 함)
        metadata.validationPassed = true;
        metadata.validationSkipped = true;
      } catch (error) {
        console.error('AI 분석 오류:', error);
        content = ''; // 텍스트 리포트 없음
        analysisProcess.step1 = { status: 'error', result: 'API 오류', details: error.message };
      }
    } else {
      content = ''; // OpenAI 없으면 텍스트 리포트 없음
      analysisProcess.step1 = { status: 'skipped', result: 'OpenAI API 키 없음', details: {} };
    }

    // AI 예측 액션 추출 (백테스팅용)
    let predictedAction = '관망';
    const actionMatch = content.match(/권장 포지션:\s*\[?([^\]]+)\]?/);
    if (actionMatch) {
      predictedAction = actionMatch[1].trim();
    }

    // 🆕 목표가 파싱 (동적으로 AI가 제시한 목표가 추출)
    const entryPrice = latestCandle.close;
    const target1Match = content.match(/1차 목표가:.*?([\d,]+)원/);
    const target2Match = content.match(/2차 목표가:.*?([\d,]+)원/);
    
    // Fallback 목표가 (설정 파일 사용, 변동성 조정 포함)
    const fallbackTargets = getFallbackTargets(
      investmentPeriod as 'swing' | 'medium' | 'long',
      entryPrice,
      volatilityLevel,
      symbol.code
    );
    let targetPrice1 = fallbackTargets.target1;
    let targetPrice2 = fallbackTargets.target2;
    
    if (target1Match) {
      targetPrice1 = parseInt(target1Match[1].replace(/,/g, ''));
    }
    if (target2Match) {
      targetPrice2 = parseInt(target2Match[1].replace(/,/g, ''));
    }
    
    // 목표 수익률 계산
    const targetPercent1 = parseFloat(((targetPrice1 - entryPrice) / entryPrice * 100).toFixed(2));
    const targetPercent2 = parseFloat(((targetPrice2 - entryPrice) / entryPrice * 100).toFixed(2));
    
    // metadata에 목표가 정보 추가
    metadata.targetPrice1 = targetPrice1;
    metadata.targetPrice2 = targetPrice2;
    metadata.targetPercent1 = targetPercent1;
    metadata.targetPercent2 = targetPercent2;

    // 🆕 손절가 계산 (설정 파일 사용, 변동성 조정 포함)
    const adjustedTargets = getAdjustedTargets(
      investmentPeriod as 'swing' | 'medium' | 'long',
      entryPrice,
      volatilityLevel,
      symbol.code
    );
    const stopLossPrice = adjustedTargets.stopLoss;
    metadata.stopLossPrice = stopLossPrice;

    // 🆕 투자 전략 생성 (리팩터링: 단일 파이프라인)
    const strategyContext: StrategyGenerationContext = {
      symbol: {
        code: symbol.code,
        name: symbol.name,
        market: symbol.market,
      },
      entryPrice,
      targetPrice1,
      targetPrice2,
      stopLossPrice,
      latestCandle,
      latestIndicator,
      candles,
      investmentPeriod: investmentPeriod as 'swing' | 'medium' | 'long',
      volatilityLevel,
      historicalContext,
    };

    // StrategyGenerator를 통한 전략 생성 (명확한 출처 추적)
    const strategyResult = await this.strategyGenerator.generateStrategy(strategyContext);
    
    // 전략 저장 및 메타데이터 업데이트
    metadata.strategy = strategyResult.strategy;
    metadata.strategyType = strategyResult.source; // 'ai' | 'rule-based' | 'fallback'
    metadata.strategyConfidence = strategyResult.confidence; // 0-1 신뢰도
    metadata.strategyGenerationTime = strategyResult.metadata.generationTime;
    metadata.strategyValidation = {
      passed: strategyResult.metadata.validationPassed,
      errors: strategyResult.metadata.validationErrors,
    };
    
    // AI 토큰 사용량 추가 (AI 전략인 경우)
    if (strategyResult.source === 'ai' && strategyResult.metadata.tokensUsed) {
      metadata.tokensUsed = (metadata.tokensUsed || 0) + strategyResult.metadata.tokensUsed;
    }

    // 1) 결과 요약 3줄 (추천 → 이유 → 행동)
    metadata.recommendationSummary = this.buildRecommendationSummary(
      predictedAction,
      latestCandle,
      latestIndicator,
      investmentPeriod,
      metadata.strategy
    );

    // 2) If-Then 구조화 (조건 → 액션 트리)
    metadata.ifThenRules = this.buildIfThenRules(metadata.strategy);

    // 3) 백테스트 요약 (성공률·평균 수익·최대 낙폭)
    if (historicalContext) {
      const maxDrawdown =
        historicalContext.minReturn !== undefined
          ? Math.min(0, historicalContext.minReturn)
          : 0;
      metadata.backtestSummary = {
        successRate: historicalContext.successRate,
        avgReturn: historicalContext.avgReturn,
        maxDrawdown, // 음수(하락률)로 표시
        totalCases: historicalContext.totalCases,
      };
    }

    // 4) 매수 단가 보정 전략 예시 (DCA 예시 금액)
    metadata.dcaExamples = this.buildDcaExamples(
      entryPrice,
      metadata.strategy,
      [1_000_000, 10_000_000]
    );

    // Save report
    const report = new this.aiReportModel({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      symbolId: new Types.ObjectId(symbolId),
      timeframe,
      reportType,
      content,
      metadata,
      analysisProcess,
      explainability,
      rawResponse,
      predictedAction,
      investmentPeriod,
      validUntil: getValidUntil(
        investmentPeriod as 'swing' | 'medium' | 'long',
        volatilityLevel
      ), // 투자 기간과 변동성에 따라 동적 계산
    });

    return report.save();
  }

  // ⚠️ DEPRECATED: AI 리포트 텍스트 미사용으로 인한 검증 메서드 제거 예정
  private validateAIResponse(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 1. 필수 섹션 확인 (4개 섹션만, 5번 섹션 제거)
    // 이모지가 포함될 수 있으므로 정규식으로 검증
    const requiredSections = [
      { pattern: /1\.\s+시장\s*포지션/, name: '1. 시장 포지션', required: true },
      { pattern: /2\.\s+핵심\s*매매\s*시그널/, name: '2. 핵심 매매 시그널', required: true },
      { pattern: /3\.\s+리스크\s*요인/, name: '3. 리스크 요인', required: true },
      { pattern: /4\.\s+정량적\s*전망\s*요약/, name: '4. 정량적 전망 요약', required: true },
    ];
    
    requiredSections.forEach(({ pattern, name, required }) => {
      if (required && !pattern.test(content)) {
        errors.push(`필수 섹션 누락: ${name}`);
      }
    });
    
    // 2. 5번 섹션이 있으면 경고 (제거되었어야 함)
    if (/5\.\s+.*맞춤\s*투자\s*전략/.test(content)) {
      console.warn('⚠️ 5번 섹션(맞춤 투자 전략)이 AI 리포트에 포함되어 있습니다. 백엔드에서 자동 생성되므로 제거해야 합니다.');
    }
    
    // 3. 최소 길이 확인 (1~4번 섹션 간소화로 매우 짧게)
    // 각 섹션이 1~2문장이므로 전체적으로 짧아야 함
    const minLength = 100; // 매우 간단하게
    
    if (content.length < minLength) {
      errors.push(`응답 길이 부족: ${content.length}자 (최소 ${minLength}자 필요)`);
    }
    
    // 4. 최대 길이 확인 (너무 길면 간소화 실패)
    const maxLength = 500; // 최대 500자로 제한
    
    if (content.length > maxLength) {
      errors.push(`응답이 너무 깁니다: ${content.length}자 (최대 ${maxLength}자). 1~4번 섹션을 더 간단히 작성하세요.`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ⚠️ DEPRECATED: AI 리포트 텍스트 미사용으로 인한 프롬프트 메서드 제거 예정
  private buildPrompt(symbol: any, candles: any[], indicators: any[], reportType: string, investmentPeriod: string = 'swing', historicalContext?: any, volatilityLevel: 'high' | 'medium' | 'low' = 'medium'): string {
    // 완성된 캔들 사용 (candles[0]은 진행 중일 수 있음)
    const latest = candles.length > 1 ? candles[1] : candles[0];
    const latestIndicator = indicators[0] || {};

    const priceChange = candles.length > 1 
      ? ((latest.close - candles[1].close) / candles[1].close * 100).toFixed(2)
      : '0';

    // Symbol에 저장된 당일 거래량 사용 (더 정확함)
    const volumeToDisplay = symbol.volume || latest.volume || 0;
    const currentPrice = symbol.currentPrice || latest.close;
    const dayOpen = symbol.dayOpen || latest.open;
    const dayHigh = symbol.dayHigh || latest.high;
    const dayLow = symbol.dayLow || latest.low;
    
    // 등락률 계산
    const changePercent = symbol.priceChangePercent || parseFloat(priceChange);
    const changeAmount = symbol.priceChange || (currentPrice - (symbol.previousClose || dayOpen));
    
    // RSI 상태 판단
    const rsiStatus = latestIndicator.rsi 
      ? (latestIndicator.rsi > 70 ? '과매수' : latestIndicator.rsi < 30 ? '과매도' : '중립')
      : 'N/A';
    
    // MACD 시그널 판단
    const macdSignal = (latestIndicator.macd && latestIndicator.macdSignal)
      ? (latestIndicator.macd > latestIndicator.macdSignal ? '매수' : '매도')
      : 'N/A';
    
    // 이평선 배열 판단
    const ma5 = latestIndicator.ma5 || 0;
    const ma20 = latestIndicator.ma20 || 0;
    const ma60 = latestIndicator.ma60 || 0;
    const maAlignment = (ma5 > ma20 && ma20 > ma60) ? '정배열(상승)' : 
                       (ma5 < ma20 && ma20 < ma60) ? '역배열(하락)' : '혼조';
    
    // 거래량 비율
    const volumeRatio = latestIndicator.volumeRatio || 1;
    const volumeStatus = volumeRatio > 1.5 ? '급증' : volumeRatio > 1.0 ? '증가' : '감소';

    // 투자 기간별 설명 (설정 파일에서 로드)
    const periodConfig = TRADING_STRATEGY_CONFIG[investmentPeriod] || TRADING_STRATEGY_CONFIG.swing;
    const periodInfo = {
      swing: { 
        name: '단기 스윙', 
        duration: '3~7일', 
        target: `+${periodConfig.target1Percent}~${periodConfig.target2Percent}%`, 
        stoploss: `-${periodConfig.stopLossPercent}%`,
        target1Percent: periodConfig.target1Percent,
        target2Percent: periodConfig.target2Percent
      },
      medium: { 
        name: '중기', 
        duration: '2~4주', 
        target: `+${TRADING_STRATEGY_CONFIG.medium.target1Percent}~${TRADING_STRATEGY_CONFIG.medium.target2Percent}%`, 
        stoploss: `-${TRADING_STRATEGY_CONFIG.medium.stopLossPercent}%`,
        target1Percent: TRADING_STRATEGY_CONFIG.medium.target1Percent,
        target2Percent: TRADING_STRATEGY_CONFIG.medium.target2Percent
      },
      long: { 
        name: '장기', 
        duration: '1~3개월', 
        target: `+${TRADING_STRATEGY_CONFIG.long.target1Percent}~${TRADING_STRATEGY_CONFIG.long.target2Percent}%`, 
        stoploss: `-${TRADING_STRATEGY_CONFIG.long.stopLossPercent}%`,
        target1Percent: TRADING_STRATEGY_CONFIG.long.target1Percent,
        target2Percent: TRADING_STRATEGY_CONFIG.long.target2Percent
      }
    };
    const period = periodInfo[investmentPeriod] || periodInfo.swing;
    
    // 변동성 조정된 목표가 계산 (설정 파일 사용, 이미 위에서 계산된 volatilityLevel 사용)
    const adjustedTargets = getAdjustedTargets(
      investmentPeriod as 'swing' | 'medium' | 'long',
      currentPrice,
      volatilityLevel,
      symbol.code
    );
    const targetPrice1 = adjustedTargets.target1;
    const targetPrice2 = adjustedTargets.target2;
    const stopLossPrice = adjustedTargets.stopLoss;

    let prompt = `당신은 금융 트레이딩 분석 모델입니다.

출력은 반드시 수치 기반 사실만 작성하며 감정적·과장형 표현은 금지합니다.

[종목 정보]
• 종목명: ${symbol.name} (${symbol.code})
• 시장: ${symbol.market}

[현재 시세] (20분 지연)
• 현재가: ${currentPrice.toLocaleString()}원
• 등락: ${changeAmount >= 0 ? '+' : ''}${changeAmount.toLocaleString()}원 (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)
• 시가: ${dayOpen.toLocaleString()}원
• 고가: ${dayHigh.toLocaleString()}원
• 저가: ${dayLow.toLocaleString()}원
• 당일 거래량: ${volumeToDisplay.toLocaleString()}주

[투자 기간 설정]
• 분석 기준: ${period.name} (${period.duration})
• 목표 수익률: ${period.target}
• 권장 손절선: ${period.stoploss}

[기술적 지표]
`;

    if (latestIndicator.rsi) {
      prompt += `• RSI(14): ${latestIndicator.rsi.toFixed(2)}\n`;
    }
    if (latestIndicator.macd && latestIndicator.macdSignal) {
      prompt += `• MACD: ${latestIndicator.macd.toFixed(2)}\n`;
      prompt += `• Signal: ${latestIndicator.macdSignal.toFixed(2)}\n`;
      prompt += `• Histogram: ${(latestIndicator.macd - latestIndicator.macdSignal).toFixed(2)}\n`;
    }
    if (latestIndicator.ma20 && latestIndicator.ma60) {
      prompt += `• MA20: ${ma20.toFixed(0)}원\n`;
      prompt += `• MA60: ${ma60.toFixed(0)}원\n`;
      prompt += `• 현재가 vs MA20: ${((currentPrice - ma20) / ma20 * 100).toFixed(2)}%\n`;
    }

    // 🆕 과거 패턴 데이터 추가
    if (historicalContext && historicalContext.totalCases > 0) {
      prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ [과거 실제 데이터 기반 검증 - 최우선 고려사항]

이 종목의 현재와 유사한 상황 (RSI ${latestIndicator.rsi ? latestIndicator.rsi.toFixed(0) : 'N/A'}, MACD ${latestIndicator.macd && latestIndicator.macdSignal ? (latestIndicator.macd > latestIndicator.macdSignal ? '상향' : '하향') : 'N/A'}):

📊 실제 과거 성과:
• 과거 발생 횟수: ${historicalContext.totalCases}회
• 실제 성공 횟수: ${historicalContext.successCases}회
• 실제 성공률: ${historicalContext.successRate}%
• 평균 수익률: ${historicalContext.avgReturn >= 0 ? '+' : ''}${historicalContext.avgReturn}%
• 최고 수익률: ${historicalContext.maxReturn >= 0 ? '+' : ''}${historicalContext.maxReturn}%
• 최저 수익률: ${historicalContext.minReturn >= 0 ? '+' : ''}${historicalContext.minReturn}%

🎯 핵심 인사이트:
${historicalContext.insight}

⚠️ 중요: 위 실제 성공률을 반드시 최우선으로 고려하세요!
단순 지표 해석보다 이 종목의 실제 과거 패턴이 더 신뢰할 수 있습니다.
만약 실제 성공률이 낮다면 (50% 미만), 지표가 좋아도 신중해야 합니다.
만약 실제 성공률이 높다면 (70% 이상), 지표가 애매해도 긍정적으로 판단할 수 있습니다.

`;
    }

    prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

분석 기준 규칙은 다음을 따르십시오:

📌 추세 판단 기준 (최우선):
현재 상황:
- 현재가: ${currentPrice.toLocaleString()}원
- MA20: ${ma20.toFixed(0)}원
- MA60: ${ma60.toFixed(0)}원
- MACD: ${latestIndicator.macd ? latestIndicator.macd.toFixed(2) : 'N/A'}
- Signal: ${latestIndicator.macdSignal ? latestIndicator.macdSignal.toFixed(2) : 'N/A'}

⚠️ 추세 판단 규칙 (반드시 준수):
1. 현재가(${currentPrice}) > MA20(${ma20.toFixed(0)}) AND MA20 > MA60 → "상승 추세"
2. 현재가(${currentPrice}) < MA20(${ma20.toFixed(0)}) AND MA20 < MA60 → "하락 추세"
3. 그 외 → "횡보"

현재 실제 판단:
- 현재가 ${currentPrice > ma20 ? '>' : '<'} MA20: ${currentPrice > ma20 ? '상승 신호' : '하락 신호'}
- MA20 ${ma20 > ma60 ? '>' : '<'} MA60: ${ma20 > ma60 ? '정배열' : '역배열'}
→ 따라서 추세는 "${currentPrice > ma20 && ma20 > ma60 ? '상승' : currentPrice < ma20 && ma20 < ma60 ? '하락' : '횡보'}"입니다.

📌 RSI 해석 기준:
- 30 이하: 강한 매수 신호
- 30~45: 매수 우위
- 45~55: 중립
- 55~70: 상승 지속 가능성
- 70 이상: 과열, 조정 가능성

📌 MACD 해석 기준:
- Signal 상향돌파: 매수 신호
- Signal 하향돌파: 매도 신호
- Histogram 증가: 상승 모멘텀 강화
- Histogram 감소: 전환 가능성

📌 상승 확률 산출 방식:
- RSI: 30%
- MACD: 40%
- 이동평균선: 30%
최종 확률 = 세 항목 점수를 합산 후 %로 표시.

📌 리스크 레벨 판단 기준 (절대 규칙):
1. 상승 확률 70% 이상 → 리스크 낮음
2. 상승 확률 50~70% → 리스크 중간
3. 상승 확률 50% 미만 → 리스크 높음

⚠️ 절대 규칙: 리스크 레벨은 상승 확률 기준으로만 결정됩니다.
- 강력 매수 (70% 이상) → 반드시 "낮음"
- 매수 (60~70%) → 반드시 "낮음" 또는 "중간"
- 관망 (50~60%) → 반드시 "중간"
- 주의/매도 (50% 미만) → 반드시 "높음"

🚫 금지사항: 리스크 레벨 뒤에 괄호나 설명을 붙이지 마세요.
올바른 예시: "리스크 레벨: 낮음"
잘못된 예시: "리스크 레벨: 중간 (⚠️ 권장 포지션과 일관성 필수)" ← 절대 금지!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ 중요: 1~4번 섹션만 작성하세요. 각 섹션은 최대 2문장으로 매우 간단하게 작성하세요.
5번 섹션(맞춤 투자 전략)은 작성하지 마세요. 백엔드에서 자동으로 생성됩니다.

아래 형식으로 정확히 출력하세요. 핵심만 간단히 요약하세요.

1. 시장 포지션
[1~2문장만, 핵심 요약]
현재 추세: [상승/하락/횡보], 강도: [약함/중간/강함]. 
현재가 ${currentPrice.toLocaleString()}원, MA20 ${ma20.toFixed(0)}원 ${currentPrice > ma20 ? '상회' : '하회'}, MACD ${latestIndicator.macd && latestIndicator.macdSignal && latestIndicator.macd > latestIndicator.macdSignal ? '상향돌파' : '하향돌파'}.

2. 핵심 매매 시그널
[1~2문장만, 핵심 요약]
RSI ${latestIndicator.rsi ? latestIndicator.rsi.toFixed(2) : 'N/A'} (${rsiStatus}), MACD ${latestIndicator.macd && latestIndicator.macdSignal && latestIndicator.macd > latestIndicator.macdSignal ? '상향돌파' : '하향돌파'}, 이동평균선 ${maAlignment}. 
${latestIndicator.macd && latestIndicator.macdSignal && latestIndicator.macd > latestIndicator.macdSignal ? '단기 모멘텀 강화' : '단기 모멘텀 약화'} 신호.

3. 리스크 요인
[1~2문장만, 핵심 리스크만]
주요 리스크: [1개 핵심 리스크만, 예: MACD 하향돌파로 단기 하락 가능성]

4. 정량적 전망 요약
[1~2문장만, 핵심 전망만]
${historicalContext && historicalContext.totalCases > 0 ? `과거 유사 패턴 성공률 ${historicalContext.successRate}% 기준, ` : ''}[간단한 전망과 결론].

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ 5번 섹션(맞춤 투자 전략)은 작성하지 마세요. 백엔드에서 자동으로 생성됩니다.

🚨 절대 규칙: 이 섹션은 반드시 아래 정확한 형식으로 작성하세요. 형식이 다르면 파싱 오류가 발생합니다.

📌 ${period.name} 전략 특성:
${investmentPeriod === 'swing' ? '- 단기 변동성 활용, 빠른 진입/청산\n- 3~7일 내 목표 달성 목표\n- 단기 기술적 지표 중심 판단' : investmentPeriod === 'medium' ? '- 중기 추세 추종 전략\n- 2~4주 내 추세 확인 후 진입\n- 중기 이동평균선과 추세선 활용' : '- 장기 성장 기대 전략\n- 1~3개월 저점 분할 매수\n- 장기 이동평균선과 펀더멘털 고려'}

⚠️ 필수 작성 규칙:
1. 모든 필드는 정확히 아래 형식으로 작성 (라벨과 콜론(:) 필수)
2. 진입비율은 반드시 "진입비율: [숫자]%" 형식 (예: "진입비율: 40%")
3. 진입타이밍은 반드시 "진입타이밍: [내용]" 형식
4. 손절가는 반드시 "손절가: [가격]원 ([비율])" 형식
5. 각 시나리오는 반드시 "상승 시나리오:", "횡보 시나리오:", "하락 시나리오:" 라벨 사용
6. 목표 달성은 반드시 "1차 목표 달성 시:", "2차 목표 달성 시:" 라벨 사용

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1일차 또는 1주차: 초기 진입]
진입비율: [숫자만, 예: 40]%
진입타이밍: [1문장으로 간결하게, 예: 현재가 ${currentPrice.toLocaleString()}원 부근에서 분할 진입]
근거:
1) 기술적: [구체적 지표명과 수치, 판단을 1문장으로, 예: RSI ${latestIndicator.rsi ? latestIndicator.rsi.toFixed(2) : 'N/A'} 상승 + MACD Signal 상향돌파로 매수 신호]
2) 추세: [현재 추세와 구체적 수치를 1문장으로, 예: 현재가가 MA20(${ma20.toFixed(0)}원) 상회로 단기 상승 가능성 존재]
3) 지지/저항: [구체적 가격대와 의미를 1문장으로, 예: ${(currentPrice * 1.02).toLocaleString()}원 저항선과 ${(currentPrice * 0.98).toLocaleString()}원 지지선 사이 박스권 형성]
4) 거래량: [거래량 상태와 의미를 1문장으로, 예: 거래량 증가 시 모멘텀 강화 가능]

손절가: ${stopLossPrice.toLocaleString()}원 (${period.stoploss})
손절타이밍: [1문장으로 간결하게, 예: 현재가가 손절가 하회 시 또는 MACD 지속 하락 시]
손절사유:
1) [하락 가능성과 리스크를 1문장으로, 예: 기술적 지표 약세로 추가 하락 가능성 존재]
2) [손실 확대 위험을 1문장으로, 예: 시장 방향성 불명확으로 손실 확대 위험]
3) [재진입 고려사항을 1문장으로, 예: 재진입은 MACD 상승세 전환 시 고려]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[2~3일차 또는 2~3주차: 상황별 대응]

⚠️ 절대 규칙: 이 섹션은 "추가 진입" 또는 "포지션 조정"을 위한 것입니다. 목표가 달성은 5~7일차 섹션에서만 다룹니다.

📊 참고 가격 (AI 판단 시 참고만 하세요):
- 현재가: ${currentPrice.toLocaleString()}원
- 1차 목표가: ${targetPrice1.toLocaleString()}원 (+${period.target1Percent}%) - ⚠️ 이 가격은 5~7일차 익절용입니다. 2~3일차에서는 사용 금지!
- 2차 목표가: ${targetPrice2.toLocaleString()}원 (+${period.target2Percent}%) - ⚠️ 이 가격은 5~7일차 익절용입니다. 2~3일차에서는 사용 금지!
- 손절가: ${stopLossPrice.toLocaleString()}원 (${period.stoploss})

🚨 절대 금지 사항:
1. 2~3일차 상승 시나리오의 조건 가격으로 1차 목표가(${targetPrice1.toLocaleString()}원)를 사용하면 안 됩니다!
2. 2~3일차는 "추가 진입" 단계이므로, 1차 목표가보다 낮은 중간 가격을 사용해야 합니다.
3. 예: 현재가 ${currentPrice.toLocaleString()}원, 1차 목표 ${targetPrice1.toLocaleString()}원이라면, 추가 진입은 ${((currentPrice + targetPrice1) / 2).toLocaleString()}원 또는 그보다 낮은 가격을 사용하세요.

💡 AI 판단 가이드:
- 상승 시나리오: 현재가와 1차 목표가 사이의 중간 가격대에서 추가 진입 조건 설정
- AI가 시장 상황을 분석하여 더 적절한 가격을 결정할 수 있지만, 반드시 1차 목표가보다 낮아야 함
- 기술적 지표(저항선, 지지선, 이동평균선 등)를 고려하여 최적의 추가 진입 가격 결정

상승 시나리오:
조건: [AI가 판단한 구체적 가격과 지표 조건, 반드시 ${targetPrice1.toLocaleString()}원보다 낮은 가격 사용, 예: ${((currentPrice + targetPrice1) / 2).toLocaleString()}원 돌파 AND RSI 55 이상] 
🚨 검증: 조건 가격이 ${targetPrice1.toLocaleString()}원보다 낮은지 확인하세요! 같거나 높으면 안 됩니다!
액션: [가격 정보 포함, 예: [조건 가격]원 돌파 시 → 시드의 [숫자]% 추가 진입]
근거:
1) [가격 상승 의미를 1문장으로, AI가 분석한 이유]
2) [지표 개선 의미를 1문장으로, AI가 분석한 이유]
3) [과거 패턴 참고를 1문장으로, AI가 분석한 이유]

횡보 시나리오:
조건: [AI가 판단한 가격 범위와 기간, 예: ${(currentPrice * 0.98).toLocaleString()}원 ~ ${(currentPrice * 1.02).toLocaleString()}원] 박스권 [AI가 판단한 기간] 이상
액션: [AI가 판단한 액션, 예: 박스권 유지 시 → 현재 포지션 유지 또는 관망]
근거:
1) [AI가 분석한 방향성 불명확 이유]
2) [AI가 분석한 돌파/이탈 확인 필요 이유]

하락 시나리오:
조건: [AI가 판단한 가격 또는 지표 조건, 예: ${stopLossPrice.toLocaleString()}원 하회 OR MACD 지속 하락]
액션: [AI가 판단한 구체적 액션, 예: [조건 가격]원 하회 시 → 포지션의 [숫자]% 청산]
근거:
1) [AI가 분석한 하락 추세 확정 이유]
2) [AI가 분석한 리스크 관리 필요 이유]
3) [AI가 분석한 재진입 타이밍]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[5~7일차 또는 4주차: 수익 실현]

⚠️ 절대 규칙: 이 섹션은 "목표가 달성 시 익절"을 위한 것입니다. 추가 진입은 2~3일차에서만 다룹니다.

📊 참고 목표가 (AI 판단 시 참고만 하세요):
- 1차 목표: ${targetPrice1.toLocaleString()}원 (+${period.target1Percent}%)
- 2차 목표: ${targetPrice2.toLocaleString()}원 (+${period.target2Percent}%)

🚨 절대 금지 사항:
1. 이 섹션에 "추가 진입" 관련 내용을 작성하면 안 됩니다!
2. 이 섹션은 오직 "익절"만 다룹니다.
3. 2~3일차에서 이미 추가 진입을 했다면, 여기서는 익절만 고려하세요.

💡 AI 판단 가이드:
- 목표가 달성 시 익절 비율은 AI가 시장 상황과 리스크를 고려하여 결정
- 1차 목표 달성 시: 부분 익절 (예: 30~50%)로 수익 확보 + 잔여 포지션으로 추가 상승 노림
- 2차 목표 달성 시: 추가 익절 (예: 30~50%) 또는 전량 청산 판단
- AI가 시장 상황에 따라 다른 전략을 제시할 수 있지만, 반드시 "익절" 관련 내용만 작성

1차 목표 달성 시:
가격: ${targetPrice1.toLocaleString()}원 (${period.name} 전략의 1차 목표, +${period.target1Percent}%)
🚨 검증: 이 가격(${targetPrice1.toLocaleString()}원)이 2~3일차 상승 시나리오 조건 가격과 다른지 확인하세요! 같으면 안 됩니다!
액션: [AI가 판단한 익절 비율과 전략, 반드시 "익절" 또는 "청산" 관련 내용만, 예: ${targetPrice1.toLocaleString()}원 달성 시 → 포지션의 [AI가 판단한 %]% 익절 (예상 수익: +${period.target1Percent}.0%)]
근거:
1) [AI가 분석한 목표가 도달 의미]
2) [AI가 분석한 잔여 포지션 관리 전략]

2차 목표 달성 시:
가격: ${targetPrice2.toLocaleString()}원 (${period.name} 전략의 2차 목표, +${period.target2Percent}%)
액션: [AI가 판단한 익절 비율과 전략, 반드시 "익절" 또는 "청산" 관련 내용만, 예: ${targetPrice2.toLocaleString()}원 달성 시 → 포지션의 [AI가 판단한 %]% 익절 또는 전량 청산]
근거:
1) [AI가 분석한 목표가 도달 의미]
2) [AI가 분석한 시장 상황과 추가 전략]

추가 전략:
1) 거래량: [조건과 액션을 1문장으로, 예: 거래량 50% 이상 증가 시 추가 진입 검토]
2) 시간: ${period.duration} 경과 시 [액션을 1문장으로, 예: 시장 반응 확인 후 재평가]
3) 시장상황: [조건과 액션을 1문장으로, 예: 주요 경제지표 발표 시 대응 전략 수립]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

※ 본 분석은 20분 지연 시세 데이터 기반으로 제공되며 투자 판단 책임은 사용자에게 있습니다.
`;

    return prompt;
  }

  // ⚠️ DEPRECATED: AI 리포트 텍스트 미사용으로 인한 Fallback 메서드 제거 예정
  private generateFallbackReport(symbol: any, candle: any, indicator: any): string {
    const volumeToDisplay = symbol.volume || candle.volume || 0;
    
    let report = `${symbol.name}(${symbol.code}) 기술적 분석 리포트\n\n`;
    report += `현재가: ${(symbol.currentPrice || candle.close).toLocaleString()}원\n`;
    report += `당일 거래량: ${volumeToDisplay.toLocaleString()}주\n`;
    report += `당일 시가: ${(symbol.dayOpen || candle.open)?.toLocaleString()}원\n`;
    report += `당일 고가: ${(symbol.dayHigh || candle.high)?.toLocaleString()}원\n`;
    report += `당일 저가: ${(symbol.dayLow || candle.low)?.toLocaleString()}원\n\n`;

    if (indicator) {
      report += `기술적 지표:\n`;
      if (indicator.rsi) {
        const rsiStatus = indicator.rsi > 70 ? '과매수' : indicator.rsi < 30 ? '과매도' : '중립';
        report += `- RSI(14): ${indicator.rsi.toFixed(2)} (${rsiStatus})\n`;
      }
      if (indicator.ma20) {
        const priceVsMA = candle.close > indicator.ma20 ? '상회' : '하회';
        report += `- 20일 이평선 대비: ${priceVsMA}\n`;
      }
    }

    report += `\n※ AI 분석 서비스가 일시적으로 이용 불가합니다. 위 기술적 지표를 참고해주세요.`;

    return report;
  }

  private analyzeTrend(candles: any[]): any {
    if (candles.length < 10) return { trend: 'unknown', strength: 0 };
    
    const recent10 = candles.slice(0, 10);
    const upCandles = recent10.filter(c => c.close > c.open).length;
    const downCandles = recent10.filter(c => c.close < c.open).length;
    
    return {
      trend: upCandles > downCandles ? 'uptrend' : downCandles > upCandles ? 'downtrend' : 'sideways',
      upCandlesCount: upCandles,
      downCandlesCount: downCandles,
      strength: Math.abs(upCandles - downCandles) / 10 * 100,
      support: Math.min(...recent10.map(c => c.low)),
      resistance: Math.max(...recent10.map(c => c.high)),
    };
  }

  private assessRisk(candles: any[], indicator: any): any {
    if (!indicator || candles.length < 10) {
      return { volatility: 'unknown', risk: 'medium' };
    }

    const recent10 = candles.slice(0, 10);
    const prices = recent10.map(c => c.close);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const volatility = (stdDev / avgPrice) * 100;

    const avgVolume = recent10.reduce((sum, c) => sum + c.volume, 0) / recent10.length;
    const volumeRatio = candles[0].volume / avgVolume;

    return {
      volatility: volatility > 5 ? '높음' : volatility > 2 ? '중간' : '낮음',
      volatilityPercent: volatility.toFixed(2),
      risk: volatility > 5 ? '높음' : volatility > 2 ? '중간' : '낮음',
      avgVolume: Math.round(avgVolume),
      currentVolume: candles[0].volume,
      volumeRatio: volumeRatio.toFixed(2),
    };
  }

  private calculateFactorWeights(indicator: any, candles: any[]): any[] {
    if (!indicator) return [];

    const factors: any[] = [];
    let totalWeight = 0;

    // RSI 가중치
    if (indicator.rsi) {
      let weight = 0;
      let impact = '';
      
      if (indicator.rsi > 70) {
        weight = 25;
        impact = '과매수 구간 (매도 압력 예상)';
      } else if (indicator.rsi < 30) {
        weight = 30;
        impact = '과매도 구간 (반등 가능성)';
      } else if (indicator.rsi > 55) {
        weight = 20;
        impact = '상승 모멘텀 지속';
      } else {
        weight = 10;
        impact = '중립 구간';
      }

      factors.push({ name: 'RSI 신호', weight, impact });
      totalWeight += weight;
    }

    // MACD 가중치
    if (indicator.macd !== undefined && indicator.macdSignal !== undefined) {
      let weight = 0;
      let impact = '';

      if (indicator.macd > indicator.macdSignal) {
        weight = 25;
        impact = 'Signal 상향돌파 (매수 신호)';
      } else {
        weight = 15;
        impact = 'Signal 하향돌파 (매도 신호)';
      }

      factors.push({ name: 'MACD 크로스오버', weight, impact });
      totalWeight += weight;
    }

    // 이동평균선 가중치
    if (indicator.ma5 && indicator.ma20 && indicator.ma60) {
      let weight = 0;
      let impact = '';

      if (indicator.ma5 > indicator.ma20 && indicator.ma20 > indicator.ma60) {
        weight = 25;
        impact = '정배열 (강한 상승 추세)';
      } else if (indicator.ma5 < indicator.ma20 && indicator.ma20 < indicator.ma60) {
        weight = 20;
        impact = '역배열 (강한 하락 추세)';
      } else {
        weight = 10;
        impact = '혼조 (방향성 불명확)';
      }

      factors.push({ name: '이동평균선 배열', weight, impact });
      totalWeight += weight;
    }

    // 거래량 가중치
    if (candles && candles.length >= 10) {
      const avgVolume = candles.slice(0, 10).reduce((sum, c) => sum + c.volume, 0) / 10;
      const volumeRatio = candles[0].volume / avgVolume;

      let weight = 0;
      let impact = '';

      if (volumeRatio > 1.5) {
        weight = 20;
        impact = `거래량 급증 (평균 대비 ${(volumeRatio * 100).toFixed(0)}%)`;
      } else if (volumeRatio > 1.0) {
        weight = 15;
        impact = `거래량 증가 (평균 대비 ${(volumeRatio * 100).toFixed(0)}%)`;
      } else {
        weight = 5;
        impact = '거래량 평범';
      }

      factors.push({ name: '거래량 분석', weight, impact });
      totalWeight += weight;
    }

    // 가중치 정규화 (총 100%로)
    factors.forEach(f => {
      f.weight = Math.round((f.weight / totalWeight) * 100);
    });

    return factors.sort((a, b) => b.weight - a.weight);
  }

  private generateReasoning(indicator: any, candles: any[]): string {
    if (!indicator) return '데이터 부족으로 분석 불가';

    const reasons: string[] = [];

    if (indicator.rsi) {
      if (indicator.rsi > 70) reasons.push('RSI 과매수 구간 진입으로 단기 조정 가능성');
      else if (indicator.rsi < 30) reasons.push('RSI 과매도 구간으로 반등 기회 포착');
      else if (indicator.rsi > 55) reasons.push('RSI 상승 모멘텀 유지');
    }

    if (indicator.macd !== undefined && indicator.macdSignal !== undefined) {
      if (indicator.macd > indicator.macdSignal) {
        reasons.push('MACD가 Signal선을 상향돌파하며 매수 신호 발생');
      }
    }

    if (indicator.ma5 && indicator.ma20) {
      if (indicator.ma5 > indicator.ma20) {
        reasons.push('단기 이동평균이 중기 이동평균을 상회하며 상승 추세 지속');
      } else {
        reasons.push('단기 이동평균이 중기 이동평균 하회로 하락 압력 존재');
      }
    }

    return reasons.join('. ') || '추가 분석 필요';
  }

  private generateAlternatives(indicator: any): string {
    if (!indicator) return '';

    const alternatives: string[] = [];

    if (indicator.rsi) {
      if (indicator.rsi > 65) {
        alternatives.push('만약 RSI가 70 이상으로 상승 시 단기 매도 검토 권장');
      } else if (indicator.rsi < 35) {
        alternatives.push('만약 RSI가 30 이하로 하락 시 추가 매수 기회 포착 가능');
      }
    }

    if (indicator.macd !== undefined && indicator.macdSignal !== undefined) {
      if (indicator.macd > indicator.macdSignal) {
        alternatives.push('MACD가 음수 전환 시 추세 전환 신호로 포지션 청산 고려');
      }
    }

    return alternatives.join('. ') || '현 시점 유지 전략 권장';
  }

  async getLatestReport(symbolId: string, timeframe?: string, userId?: string) {
    const query: any = {
      symbolId: new Types.ObjectId(symbolId),
      // ✅ timeframe 필터 제거 - 투자 기간 상관없이 가장 최근 리포트 반환
    };

    // ✅ userId 필터링
    if (userId) {
      query.userId = new Types.ObjectId(userId);
    }

    return this.aiReportModel.findOne(query).sort({ createdAt: -1 });
  }

  async getUserReports(userId?: string, limit: number = 20) {
    if (!userId) return [];
    return this.aiReportModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('symbolId')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async getSymbolHistory(symbolId: string, userId?: string, limit: number = 10) {
    if (!userId) return [];
    const reports = await this.aiReportModel
      .find({
        symbolId: new Types.ObjectId(symbolId),
        userId: new Types.ObjectId(userId)
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return reports.map((report: any) => ({
      date: report.createdAt || new Date(),
      action: report.predictedAction || '관망',
      price: report.metadata?.priceAtGeneration || 0,
      actualChange: report.actualOutcome?.priceChangePercent || null,
      correct: report.actualOutcome?.wasDirectionCorrect || null,
      confidence: report.metadata?.confidence ? Math.round(report.metadata.confidence * 100) : null,
      reportId: report._id,
    }));
  }

  async getBacktestingStats(symbolId: string, userId?: string) {
    if (!userId) {
      return {
        totalPredictions: 0,
        accuracy: 0,
        buyAccuracy: 0,
        sellAccuracy: 0,
        avgProfit: 0,
        actionBreakdown: {
          strongBuy: { count: 0, accuracy: 0 },
          buy: { count: 0, accuracy: 0 },
          hold: { count: 0, accuracy: 0 },
          caution: { count: 0, accuracy: 0 },
          sell: { count: 0, accuracy: 0 },
        }
      };
    }
    const reports = await this.aiReportModel
      .find({
        symbolId: new Types.ObjectId(symbolId),
        userId: new Types.ObjectId(userId),
        'actualOutcome.wasDirectionCorrect': { $exists: true }
      })
      .lean();

    if (reports.length === 0) {
      return {
        totalPredictions: 0,
        accuracy: 0,
        buyAccuracy: 0,
        sellAccuracy: 0,
        avgProfit: 0,
        actionBreakdown: {
          strongBuy: { count: 0, accuracy: 0 },
          buy: { count: 0, accuracy: 0 },
          hold: { count: 0, accuracy: 0 },
          caution: { count: 0, accuracy: 0 },
          sell: { count: 0, accuracy: 0 },
        }
      };
    }

    const totalPredictions = reports.length;
    const correctPredictions = reports.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
    const accuracy = (correctPredictions / totalPredictions * 100).toFixed(0);

    const buyReports = reports.filter(r => r.predictedAction?.includes('매수'));
    const buyCorrect = buyReports.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
    const buyAccuracy = buyReports.length > 0 ? (buyCorrect / buyReports.length * 100).toFixed(0) : 0;

    const sellReports = reports.filter(r => r.predictedAction?.includes('매도') || r.predictedAction?.includes('주의'));
    const sellCorrect = sellReports.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
    const sellAccuracy = sellReports.length > 0 ? (sellCorrect / sellReports.length * 100).toFixed(0) : 0;

    const avgProfit = buyReports
      .filter(r => r.actualOutcome?.priceChangePercent !== undefined)
      .reduce((sum, r) => sum + (r.actualOutcome?.priceChangePercent || 0), 0) / Math.max(buyReports.length, 1);

    // Action breakdown
    const actionBreakdown = {
      strongBuy: this.calculateActionStats(reports, '강력 매수'),
      buy: this.calculateActionStats(reports, '매수'),
      hold: this.calculateActionStats(reports, '관망'),
      caution: this.calculateActionStats(reports, '주의'),
      sell: this.calculateActionStats(reports, '매도'),
    };

    return {
      totalPredictions,
      accuracy: parseFloat(accuracy),
      buyAccuracy: parseFloat(buyAccuracy as string),
      sellAccuracy: parseFloat(sellAccuracy as string),
      avgProfit: parseFloat(avgProfit.toFixed(2)),
      actionBreakdown,
    };
  }

  private calculateActionStats(reports: any[], action: string) {
    const filtered = reports.filter(r => r.predictedAction === action);
    const correct = filtered.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
    return {
      count: filtered.length,
      accuracy: filtered.length > 0 ? parseFloat((correct / filtered.length * 100).toFixed(0)) : 0,
    };
  }

  /**
   * 플랫폼 전체 통계 (모든 사용자 통합)
   */
  async getPlatformStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const reports = await this.aiReportModel
      .find({ 
        createdAt: { $gte: thirtyDaysAgo },
        'actualOutcome.wasDirectionCorrect': { $exists: true }
      })
      .lean();

    if (reports.length === 0) {
      return this.getEmptyStats();
    }

    return this.calculateStats(reports);
  }

  /**
   * 내 통합 통계 (모든 종목 통합). userId 없으면 빈 통계 반환 (비로그인).
   */
  async getMyStats(userId?: string) {
    if (!userId) return this.getEmptyStats();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const reports = await this.aiReportModel
      .find({
        userId: new Types.ObjectId(userId),
        createdAt: { $gte: thirtyDaysAgo },
        'actualOutcome.wasDirectionCorrect': { $exists: true }
      })
      .lean();

    if (reports.length === 0) {
      return this.getEmptyStats();
    }

    return this.calculateStats(reports);
  }

  /**
   * 통계 계산 (공통 로직)
   */
  private calculateStats(reports: any[]) {
    const totalAnalysis = reports.length;
    
    // 방향 정확도
    const directionCorrect = reports.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
    const directionAccuracy = parseFloat((directionCorrect / totalAnalysis * 100).toFixed(1));
    
    // 1차 목표 달성률
    const target1Achieved = reports.filter(r => r.actualOutcome?.wasTarget1Achieved).length;
    const target1AchievementRate = parseFloat((target1Achieved / totalAnalysis * 100).toFixed(1));
    
    // 2차 목표 달성률
    const target2Achieved = reports.filter(r => r.actualOutcome?.wasTarget2Achieved).length;
    const target2AchievementRate = parseFloat((target2Achieved / totalAnalysis * 100).toFixed(1));
    
    // 평균 수익률
    const buyReports = reports.filter(r => r.predictedAction?.includes('매수'));
    const avgProfit = buyReports.length > 0
      ? buyReports.reduce((sum, r) => sum + (r.actualOutcome?.priceChangePercent || 0), 0) / buyReports.length
      : 0;
    
    // 투자 기간별 통계
    const byPeriod = {
      swing: this.calculatePeriodStats(reports.filter(r => r.investmentPeriod === 'swing')),
      medium: this.calculatePeriodStats(reports.filter(r => r.investmentPeriod === 'medium')),
      long: this.calculatePeriodStats(reports.filter(r => r.investmentPeriod === 'long')),
    };
    
    // 액션별 통계
    const byAction = {
      strongBuy: this.calculateActionStatsDetailed(reports, '강력 매수'),
      buy: this.calculateActionStatsDetailed(reports, '매수'),
      hold: this.calculateActionStatsDetailed(reports, '관망'),
      caution: this.calculateActionStatsDetailed(reports, '주의'),
      sell: this.calculateActionStatsDetailed(reports, '매도'),
    };

    return {
      totalAnalysis,
      directionAccuracy,
      target1AchievementRate,
      target2AchievementRate,
      avgProfit: parseFloat(avgProfit.toFixed(2)),
      byPeriod,
      byAction,
    };
  }

  /**
   * 기간별 통계 계산
   */
  private calculatePeriodStats(reports: any[]) {
    if (reports.length === 0) {
      return {
        count: 0,
        target1Rate: 0,
        target2Rate: 0,
        avgProfit: 0,
      };
    }

    const target1Achieved = reports.filter(r => r.actualOutcome?.wasTarget1Achieved).length;
    const target2Achieved = reports.filter(r => r.actualOutcome?.wasTarget2Achieved).length;
    const buyReports = reports.filter(r => r.predictedAction?.includes('매수'));
    const avgProfit = buyReports.length > 0
      ? buyReports.reduce((sum, r) => sum + (r.actualOutcome?.priceChangePercent || 0), 0) / buyReports.length
      : 0;

    return {
      count: reports.length,
      target1Rate: parseFloat((target1Achieved / reports.length * 100).toFixed(1)),
      target2Rate: parseFloat((target2Achieved / reports.length * 100).toFixed(1)),
      avgProfit: parseFloat(avgProfit.toFixed(2)),
    };
  }

  /**
   * 액션별 상세 통계
   */
  private calculateActionStatsDetailed(reports: any[], action: string) {
    const filtered = reports.filter(r => r.predictedAction === action);
    
    if (filtered.length === 0) {
      return {
        count: 0,
        directionAccuracy: 0,
        target1Rate: 0,
        target2Rate: 0,
        avgProfit: 0,
      };
    }

    const directionCorrect = filtered.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
    const target1Achieved = filtered.filter(r => r.actualOutcome?.wasTarget1Achieved).length;
    const target2Achieved = filtered.filter(r => r.actualOutcome?.wasTarget2Achieved).length;
    const avgProfit = filtered
      .filter(r => r.actualOutcome?.priceChangePercent !== undefined)
      .reduce((sum, r) => sum + (r.actualOutcome?.priceChangePercent || 0), 0) / filtered.length;

    return {
      count: filtered.length,
      directionAccuracy: parseFloat((directionCorrect / filtered.length * 100).toFixed(1)),
      target1Rate: parseFloat((target1Achieved / filtered.length * 100).toFixed(1)),
      target2Rate: parseFloat((target2Achieved / filtered.length * 100).toFixed(1)),
      avgProfit: parseFloat(avgProfit.toFixed(2)),
    };
  }

  /**
   * 빈 통계 반환
   */
  private getEmptyStats() {
    return {
      totalAnalysis: 0,
      directionAccuracy: 0,
      target1AchievementRate: 0,
      target2AchievementRate: 0,
      avgProfit: 0,
      byPeriod: {
        swing: { count: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        medium: { count: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        long: { count: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
      },
      byAction: {
        strongBuy: { count: 0, directionAccuracy: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        buy: { count: 0, directionAccuracy: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        hold: { count: 0, directionAccuracy: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        caution: { count: 0, directionAccuracy: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        sell: { count: 0, directionAccuracy: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
      },
    };
  }

  /**
   * 🆕 과거 유사 패턴 분석 (백테스팅 데이터 활용)
   * 현재 지표와 유사한 과거 상황의 실제 성과를 조회
   */
  private async getHistoricalContext(symbolId: string, currentIndicator: any) {
    if (!currentIndicator || !currentIndicator.rsi) {
      return null;
    }

    try {
      // RSI ±10, MACD 방향 동일한 과거 케이스 검색
      const rsiMin = currentIndicator.rsi - 10;
      const rsiMax = currentIndicator.rsi + 10;
      const macdDirection = currentIndicator.macd > currentIndicator.macdSignal ? 'bullish' : 'bearish';

      const similarReports = await this.aiReportModel.find({
        symbolId: new Types.ObjectId(symbolId),
        'metadata.rsiAtGeneration': { $gte: rsiMin, $lte: rsiMax },
        'actualOutcome.wasCorrect': { $exists: true },
        createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // 최근 90일
      }).lean();

      // MACD 방향 필터링
      const filteredReports = similarReports.filter(report => {
        const reportMacd = report.metadata?.macd || 0;
        const reportSignal = report.metadata?.macdSignal || 0;
        const reportDirection = reportMacd > reportSignal ? 'bullish' : 'bearish';
        return reportDirection === macdDirection;
      });

      if (filteredReports.length === 0) {
        return null;
      }

      // 통계 계산
      const totalCases = filteredReports.length;
      const successCases = filteredReports.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
      const successRate = Math.round((successCases / totalCases) * 100);

      const returns = filteredReports
        .map(r => r.actualOutcome?.priceChangePercent)
        .filter((r): r is number => typeof r === 'number');

      const avgReturn =
        returns.length > 0
          ? parseFloat(
              (returns.reduce((sum, r) => sum + r, 0) / returns.length).toFixed(2),
            )
          : 0;

      const maxReturn = returns.length > 0 ? parseFloat(Math.max(...returns).toFixed(2)) : 0;
      const minReturn = returns.length > 0 ? parseFloat(Math.min(...returns).toFixed(2)) : 0;

      // 간단한 분위수(25%, 75%) 계산 – 기대 수익 구간 등에 활용 가능
      let p25 = 0;
      let p75 = 0;
      if (returns.length > 0) {
        const sorted = [...returns].sort((a, b) => a - b);
        const idx25 = Math.floor((sorted.length - 1) * 0.25);
        const idx75 = Math.floor((sorted.length - 1) * 0.75);
        p25 = parseFloat(sorted[idx25].toFixed(2));
        p75 = parseFloat(sorted[idx75].toFixed(2));
      }

      // 인사이트 생성
      let insight = '';
      if (successRate >= 70) {
        insight = `✅ 이 패턴은 과거 높은 성공률(${successRate}%)을 보였습니다. 신뢰도 높은 신호입니다.`;
      } else if (successRate >= 50) {
        insight = `⚠️ 이 패턴은 과거 중간 성공률(${successRate}%)을 보였습니다. 신중한 접근이 필요합니다.`;
      } else {
        insight = `❌ 이 패턴은 과거 낮은 성공률(${successRate}%)을 보였습니다. 지표가 좋아도 주의가 필요합니다.`;
      }

      if (avgReturn < -2) {
        insight += ` 평균 손실률이 ${avgReturn}%로 높아 리스크가 큽니다.`;
      } else if (avgReturn > 3) {
        insight += ` 평균 수익률이 ${avgReturn}%로 양호합니다.`;
      }

      return {
        totalCases,
        successCases,
        successRate,
        avgReturn,
        maxReturn,
        minReturn,
        p25,
        p75,
        insight
      };
    } catch (error) {
      console.error('Historical context error:', error);
      return null;
    }
  }

  /**
   * 프리미엄: AI를 활용한 상세 투자 전략 생성
   */
  private async generatePremiumStrategy(
    symbol: any,
    latestCandle: any,
    latestIndicator: any,
    candles: any[],
    entryPrice: number,
    targetPrice1: number,
    targetPrice2: number,
    stopLossPrice: number,
    investmentPeriod: 'swing' | 'medium' | 'long',
    volatilityLevel: 'high' | 'medium' | 'low',
    historicalContext: any,
    symbolCode?: string
  ): Promise<any | null> {
    if (!this.openai) {
      return null; // OpenAI가 없으면 null 반환
    }

    try {
      const currentPrice = latestCandle.close;
      const rsi = latestIndicator?.rsi || 50;
      const macd = latestIndicator?.macd || 0;
      const macdSignal = latestIndicator?.macdSignal || 0;
      const ma20 = latestIndicator?.ma20 || currentPrice;
      const ma60 = latestIndicator?.ma60 || currentPrice;
      const volume = latestCandle.volume || 0;
      const avgVolume = candles.slice(0, 20).reduce((sum, c) => sum + (c.volume || 0), 0) / Math.min(20, candles.length);

      const strategyPrompt = `당신은 전문 투자 전략 분석가입니다. 아래 기술적 지표와 시장 상황을 분석하여 매우 상세하고 실용적인 투자 전략을 JSON 형식으로 생성하세요.

[종목 정보]
- 종목명: ${symbol.name}
- 현재가: ${currentPrice.toLocaleString()}원
- 투자 기간: ${investmentPeriod === 'swing' ? '3~7일 단기 스윙' : investmentPeriod === 'medium' ? '2~4주 중기' : '1~3개월 장기'}

[기술적 지표]
- RSI: ${rsi.toFixed(2)} ${rsi > 70 ? '(과매수)' : rsi < 30 ? '(과매도)' : '(중립)'}
- MACD: ${macd.toFixed(2)}, Signal: ${macdSignal.toFixed(2)}, Histogram: ${(macd - macdSignal).toFixed(2)}
- MA20: ${ma20.toFixed(0)}원, MA60: ${ma60.toFixed(0)}원
- 현재가 대비 MA20: ${currentPrice > ma20 ? '상회' : '하회'} (${((currentPrice - ma20) / ma20 * 100).toFixed(2)}%)
- 거래량: ${volume.toLocaleString()}주 (평균 대비 ${avgVolume > 0 ? ((volume / avgVolume) * 100).toFixed(0) : '100'}%)
- 변동성: ${volatilityLevel}

[목표가 및 손절가]
- 진입가: ${entryPrice.toLocaleString()}원
- 1차 목표가: ${targetPrice1.toLocaleString()}원 (+${((targetPrice1 - entryPrice) / entryPrice * 100).toFixed(1)}%)
- 2차 목표가: ${targetPrice2.toLocaleString()}원 (+${((targetPrice2 - entryPrice) / entryPrice * 100).toFixed(1)}%)
- 손절가: ${stopLossPrice.toLocaleString()}원 (${((stopLossPrice - entryPrice) / entryPrice * 100).toFixed(1)}%)
- 추가 진입 권장가: ${Math.floor((currentPrice + targetPrice1) / 2).toLocaleString()}원 (현재가와 1차 목표가 중간)

${historicalContext ? `[과거 유사 패턴]
- 성공률: ${historicalContext.successRate}%
- 평균 수익률: ${historicalContext.avgReturn}%
- 최대 수익률: ${historicalContext.maxReturn}%
- 최소 수익률: ${historicalContext.minReturn}%
- 인사이트: ${historicalContext.insight}` : ''}

[요구사항 - 매우 중요]
다음 JSON 형식으로 매우 상세하고 실용적인 투자 전략을 생성하세요. 모든 액션은 구체적인 비율과 금액을 포함해야 합니다.

{
  "phase1": {
    "entryRatio": [숫자, 25-40 사이, RSI와 MACD 신호 강도에 따라 결정],
    "entryTiming": "[매우 구체적인 진입 타이밍, 예: 현재가 ${currentPrice.toLocaleString()}원에서 즉시 진입 또는 ${currentPrice.toLocaleString()}원 부근에서 분할 진입]",
    "reasoning": "[4가지 근거를 번호로 구분하여 매우 상세히 작성, 각 근거는 1-2문장으로 구체적 수치 포함]\\n1) 기술적: RSI ${rsi.toFixed(2)}가 [과매수/과매도/중립] 영역에 있으며, MACD ${macd.toFixed(2)}가 Signal ${macdSignal.toFixed(2)}를 [상향돌파/하향돌파]하여 [매수/매도] 신호를 나타냄.\\n2) 추세: 현재가 ${currentPrice.toLocaleString()}원이 MA20(${ma20.toFixed(0)}원)을 [상회/하회]하고 있어 단기 [상승/하락] 추세를 [지지/저항]함.\\n3) 지지/저항: [구체적 가격대, 예: ${stopLossPrice.toLocaleString()}원이 손절가로 설정되어 있어 강한 지지선으로 작용] 또는 [저항선과 지지선 사이 박스권 형성].\\n4) 거래량: 거래량이 평균 대비 ${avgVolume > 0 ? ((volume / avgVolume) * 100).toFixed(0) : '100'}%로 [증가/감소]하여 [매수/매도] 모멘텀을 [강화/약화]하고 있음.",
    "stopLoss": {
      "price": ${stopLossPrice},
      "percent": ${((stopLossPrice - entryPrice) / entryPrice * 100).toFixed(1)},
      "timing": "[매우 구체적인 손절 타이밍, 예: 진입 후 즉시 손절가 설정 또는 현재가가 손절가 하회 시 또는 MACD 지속 하락 시]",
      "reason": "[손절 사유를 번호로 구분하여 매우 상세히 작성]\\n1) 기술적 지표 분석: 손절가 이하로 하락 시 기술적 신호가 부정적으로 변할 수 있음.\\n2) 리스크 관리 관점: 손실을 최소화하기 위해 손절가 설정이 필요함.\\n3) 재진입 고려사항: 손절가에 도달 시 시장 상황을 재분석하여 재진입 여부 결정."
    }
  },
  "phase2": {
    "bullish": {
      "condition": "[매우 구체적 가격과 지표 조건, 반드시 ${Math.floor((currentPrice + targetPrice1) / 2).toLocaleString()}원보다 낮은 가격 사용, 예: ${Math.floor((currentPrice + targetPrice1) / 2).toLocaleString()}원 돌파 AND RSI 55 이상]",
      "action": "[매우 구체적 액션, 반드시 비율 포함, 예: 시드의 30% 추가 진입 또는 포지션의 20% 추가 매수]",
      "actionRatio": [숫자, 20-40 사이],
      "reason": "[근거를 번호로 구분하여 매우 상세히 작성]\\n1) 가격 상승 의미: [구체적 가격] 이하에서의 매수는 상승세를 강화할 수 있음.\\n2) 지표 개선 의미: MACD가 0을 상회하면 강한 상승 신호로 해석됨.\\n3) 과거 패턴 분석: ${historicalContext ? `과거 유사 패턴에서 성공률 ${historicalContext.successRate}%로 가격 상승이 나타났던 경우가 있었음.` : '과거 유사 패턴에서 가격 상승이 나타났던 경우가 있었음.'}"
    },
    "sideways": {
      "condition": "[매우 구체적 가격 범위와 기간, 예: ${Math.floor(currentPrice * 0.98).toLocaleString()}원에서 ${Math.floor(currentPrice * 1.02).toLocaleString()}원 사이에서 2일 이상 지속될 경우]",
      "action": "[매우 구체적 액션, 예: 현재 포지션 유지 또는 관망 또는 추가 진입 보류]",
      "reason": "[근거를 번호로 구분하여 매우 상세히 작성]\\n1) 방향성 불명확 이유: 가격이 일정 범위 내에서 움직일 경우 추가적인 신호가 필요함.\\n2) 돌파/이탈 확인 필요 이유: 명확한 방향성을 확인하기 위해서는 돌파 또는 이탈이 필요함."
    },
    "bearish": {
      "condition": "[매우 구체적 가격 또는 지표 조건, 예: ${stopLossPrice.toLocaleString()}원 이하로 하락할 경우 OR MACD 지속 하락]",
      "action": "[매우 구체적 액션, 반드시 비율 포함, 예: 포지션의 50% 청산 또는 즉시 매도]",
      "exitRatio": [숫자, 50-100 사이],
      "reason": "[근거를 번호로 구분하여 매우 상세히 작성]\\n1) 하락 추세 확정 이유: 손절가 이하로 하락 시 하락 추세가 확정됨.\\n2) 리스크 관리 필요 이유: 손실을 최소화하기 위해 즉시 매도 필요.\\n3) 재진입 고려사항: 시장 상황을 재분석 후 재진입 여부 결정."
    }
  },
  "phase3": {
    "target1": {
      "price": "${targetPrice1.toLocaleString()}원 (${investmentPeriod === 'swing' ? '단기 스윙' : investmentPeriod === 'medium' ? '중기' : '장기'} 전략의 1차 목표, +${((targetPrice1 - entryPrice) / entryPrice * 100).toFixed(1)}%)",
      "action": "[매우 구체적 액션, 반드시 비율과 금액 포함, 예: ${targetPrice1.toLocaleString()}원 달성 시 → 포지션의 50% 익절 (예상 수익: +${((targetPrice1 - entryPrice) / entryPrice * 100).toFixed(1)}%) 또는 부분 매도]",
      "exitRatio": [숫자, 30-60 사이],
      "reason": "[근거를 번호로 구분하여 매우 상세히 작성]\\n1) 목표가 도달 의미: 1차 목표가 도달 시 일부 수익 실현 가능.\\n2) 잔여 포지션 관리 전략: 나머지 포지션은 시장 상황에 따라 추가 목표가로 관리."
    },
    "target2": {
      "price": "${targetPrice2.toLocaleString()}원 (${investmentPeriod === 'swing' ? '단기 스윙' : investmentPeriod === 'medium' ? '중기' : '장기'} 전략의 2차 목표, +${((targetPrice2 - entryPrice) / entryPrice * 100).toFixed(1)}%)",
      "action": "[매우 구체적 액션, 반드시 비율과 금액 포함, 예: ${targetPrice2.toLocaleString()}원 달성 시 → 포지션의 30% 추가 익절 또는 전량 매도]",
      "exitRatio": [숫자, 30-100 사이],
      "reason": "[근거를 번호로 구분하여 매우 상세히 작성]\\n1) 목표가 도달 의미: 2차 목표가 도달 시 전체 포지션 매도하여 수익 실현.\\n2) 시장 상황 고려: 목표가 도달 후 시장의 하락 신호가 나타날 경우 추가 손실 방지."
    }
  },
  "riskPlans": {
    "conservative": {
      "name": "보수형",
      "entryRatio": [숫자, 15-35 사이, 리스크를 가장 낮게 설정],
      "addRatio": [숫자, 15-30 사이, 추가 진입 비율],
      "stopLossPercent": [숫자, -8에서 -2 사이, 손실 한도를 보수적으로 설정],
      "expectedReturnMin": [숫자, 1-3 사이, 기대 최소 수익률(%)],
      "expectedReturnMax": [숫자, expectedReturnMin 이상, 기대 최대 수익률(%)],
      "comment": "계좌 변동성을 최소화하는 보수형 전략 (느리지만 안정적인 수익 지향)"
    },
    "basic": {
      "name": "기본형",
      "entryRatio": [숫자, 25-50 사이, 현재 phase1.entryRatio를 중심으로 설정],
      "addRatio": [숫자, 20-40 사이, 추가 진입 비율],
      "stopLossPercent": [숫자, -7에서 -3 사이, 중간 수준 리스크],
      "expectedReturnMin": [숫자, 2-5 사이, 기대 최소 수익률(%)],
      "expectedReturnMax": [숫자, expectedReturnMin 이상, 기대 최대 수익률(%)],
      "comment": "현재 기술적·과거 패턴을 기준으로 한 균형 잡힌 기본 전략"
    },
    "aggressive": {
      "name": "공격형",
      "entryRatio": [숫자, 40-70 사이, 초기 진입 비율을 가장 크게 설정],
      "addRatio": [숫자, 20-40 사이, 강한 추세 시 추가 진입],
      "stopLossPercent": [숫자, -10에서 -5 사이, 손실 허용 폭을 가장 크게 설정],
      "expectedReturnMin": [숫자, 3-7 사이, 기대 최소 수익률(%)],
      "expectedReturnMax": [숫자, expectedReturnMin 이상, 기대 최대 수익률(%)],
      "comment": "변동성을 감수하고 수익을 극대화하려는 공격적인 전략"
    }
  }
}

⚠️ 절대 규칙:
1. JSON 형식으로만 응답하세요 (설명 없이)
2. 모든 액션은 반드시 구체적인 비율(%, 숫자)과 금액을 포함해야 합니다
3. "추가 매수", "관망", "부분 매도", "전량 매도" 같은 모호한 표현 금지
4. 대신 "시드의 30% 추가 진입", "포지션의 50% 익절", "전량 청산" 같은 구체적 표현 사용
5. phase2.bullish의 condition 가격은 반드시 ${targetPrice1.toLocaleString()}원보다 낮아야 합니다
6. 각 근거는 구체적 수치와 함께 1-2문장으로 작성하세요`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 전문 투자 전략 분석가입니다. 기술적 지표와 시장 상황을 분석하여 상세하고 실용적인 투자 전략을 JSON 형식으로 생성합니다. JSON만 응답하고 설명은 추가하지 마세요.',
          },
          {
            role: 'user',
            content: strategyPrompt,
          },
        ],
        temperature: 0.3, // 일관성 높은 전략 생성
        max_tokens: 2000, // 상세 전략을 위한 충분한 토큰
        response_format: { type: 'json_object' }, // JSON 형식 강제
      });

      const strategyJson = completion.choices[0].message.content || '';
      const strategy = JSON.parse(strategyJson);

      // JSON 구조 검증
      if (strategy.phase1 && strategy.phase2 && strategy.phase3) {
        console.log('✅ 프리미엄 전략 생성 성공');
        return strategy;
      } else {
        console.warn('⚠️ 프리미엄 전략 JSON 구조 불완전');
        return null;
      }
    } catch (error) {
      console.warn('프리미엄 전략 생성 실패:', error.message);
      return null; // 실패 시 null 반환하여 기본 전략 사용
    }
  }

  /**
   * 기본: 기술적 지표 기반으로 투자 전략 직접 생성 (간단 버전)
   */
  private generateStrategyFromIndicators(
    latestCandle: any,
    latestIndicator: any,
    entryPrice: number,
    targetPrice1: number,
    targetPrice2: number,
    stopLossPrice: number,
    investmentPeriod: 'swing' | 'medium' | 'long',
    volatilityLevel: 'high' | 'medium' | 'low',
    symbolCode?: string
  ): any {
    const currentPrice = latestCandle.close;
    const ma20 = latestIndicator?.ma20 || currentPrice;
    const ma60 = latestIndicator?.ma60 || currentPrice;
    const rsi = latestIndicator?.rsi || 50;
    const macd = latestIndicator?.macd || 0;
    const macdSignal = latestIndicator?.macdSignal || 0;
    const macdHistogram = macd - macdSignal;

    // 진입 비율 결정 (RSI와 MACD 기반)
    let entryRatio = 30; // 기본값
    if (rsi > 55 && macdHistogram > 0) {
      entryRatio = 40; // 강한 매수 신호
    } else if (rsi > 50 && macdHistogram > 0) {
      entryRatio = 35; // 중간 매수 신호
    } else if (rsi < 45 || macdHistogram < 0) {
      entryRatio = 25; // 약한 신호
    }

    // 진입 타이밍 생성
    const entryTiming = `현재가 ${currentPrice.toLocaleString()}원 부근에서 분할 진입`;

    // 근거 생성
    const reasoning = [
      `기술적: RSI ${rsi.toFixed(2)} ${rsi > 50 ? '상승' : '하락'} + MACD Signal ${macdHistogram > 0 ? '상향돌파' : '하향돌파'}로 ${macdHistogram > 0 ? '매수' : '매도'} 신호`,
      `추세: 현재가가 MA20(${ma20.toFixed(0)}원) ${currentPrice > ma20 ? '상회' : '하회'}로 단기 ${currentPrice > ma20 ? '상승' : '하락'} 가능성 존재`,
      `지지/저항: ${(currentPrice * 1.02).toLocaleString()}원 저항선과 ${(currentPrice * 0.98).toLocaleString()}원 지지선 사이 박스권 형성`,
      `거래량: 거래량 증가 시 모멘텀 강화 가능`
    ].join('\n');

    // 손절 정보
    const stopLoss = {
      price: stopLossPrice,
      percent: -Math.abs((stopLossPrice - currentPrice) / currentPrice * 100),
      timing: '현재가가 손절가 하회 시 또는 MACD 지속 하락 시',
      reason: [
        '기술적 지표 약세로 추가 하락 가능성 존재',
        '시장 방향성 불명확으로 손실 확대 위험',
        '재진입은 MACD 상승세 전환 시 고려'
      ].join('\n')
    };

    // Phase1 생성
    const phase1 = {
      entryRatio,
      entryTiming,
      reasoning,
      stopLoss
    };

    // Phase2 생성 (상승/횡보/하락 시나리오)
    const phase2: any = {};

    // 상승 시나리오: 중간 가격대에서 추가 진입 (1차 목표가보다 낮게)
    const additionalEntryPrice = Math.floor((currentPrice + targetPrice1) / 2);
    if (rsi > 50 && macdHistogram > 0) {
      phase2.bullish = {
        condition: `${additionalEntryPrice.toLocaleString()}원 돌파 AND RSI 55 이상`,
        action: `시드의 30% 추가 진입`,
        actionRatio: 30,
        reason: [
          '가격 상승은 추세 전환 신호로 해석 가능',
          '지표 개선은 모멘텀 강화의 의미',
          '과거 유사 패턴에서 상승 지속 가능성 높음'
        ].join('\n')
      };
    }

    // 횡보 시나리오
    const sidewaysLow = Math.floor(currentPrice * 0.98);
    const sidewaysHigh = Math.floor(currentPrice * 1.02);
    phase2.sideways = {
      condition: `${sidewaysLow.toLocaleString()}원 ~ ${sidewaysHigh.toLocaleString()}원 박스권 3일 이상`,
      action: '현재 포지션 유지 또는 관망',
      reason: [
        '방향성 불명확으로 대기 필요',
        '돌파/이탈 신호 확인 후 추가 조치 필요'
      ].join('\n')
    };

    // 하락 시나리오
    phase2.bearish = {
      condition: `${stopLossPrice.toLocaleString()}원 하회 OR MACD 지속 하락`,
      action: `포지션의 50% 청산`,
      exitRatio: 50,
      reason: [
        '하락 추세 확정으로 손실 확대 위험',
        '추가 하락 가능성에 대한 리스크 관리 필요',
        '재진입은 MACD 상승세 전환 시 고려'
      ].join('\n')
    };

    // Phase3 생성 (목표 달성)
    const phase3: any = {};

    // 1차 목표 달성
    const target1Percent = ((targetPrice1 - currentPrice) / currentPrice * 100).toFixed(1);
    phase3.target1 = {
      price: `${targetPrice1.toLocaleString()}원 (${investmentPeriod === 'swing' ? '단기 스윙' : investmentPeriod === 'medium' ? '중기' : '장기'} 전략의 1차 목표, +${target1Percent}%)`,
      action: `${targetPrice1.toLocaleString()}원 달성 시 → 포지션의 50% 익절 (예상 수익: +${target1Percent}%)`,
      exitRatio: 50,
      reason: [
        '목표가 도달로 수익 확보 필요',
        '추가 상승 가능성 고려하여 잔여 포지션 관리'
      ].join('\n')
    };

    // 2차 목표 달성
    const target2Percent = ((targetPrice2 - currentPrice) / currentPrice * 100).toFixed(1);
    phase3.target2 = {
      price: `${targetPrice2.toLocaleString()}원 (${investmentPeriod === 'swing' ? '단기 스윙' : investmentPeriod === 'medium' ? '중기' : '장기'} 전략의 2차 목표, +${target2Percent}%)`,
      action: `${targetPrice2.toLocaleString()}원 달성 시 → 포지션의 30% 추가 익절 또는 전량 청산`,
      exitRatio: 30,
      reason: [
        '목표가 도달로 추가 수익 실현',
        '시장 상황에 따른 추가 전략 고려'
      ].join('\n')
    };

    return {
      phase1,
      phase2,
      phase3
    };
  }

  /**
   * Fallback 전략 생성 (에러 시 사용)
   */
  private generateFallbackStrategy(
    entryPrice: number,
    targetPrice1: number,
    targetPrice2: number,
    stopLossPrice: number,
    investmentPeriod: 'swing' | 'medium' | 'long'
  ): any {
    return {
      phase1: {
        entryRatio: 30,
        entryTiming: `현재가 ${entryPrice.toLocaleString()}원 부근에서 분할 진입`,
        reasoning: '기본 전략: 기술적 지표 기반 진입',
        stopLoss: {
          price: stopLossPrice,
          percent: -Math.abs((stopLossPrice - entryPrice) / entryPrice * 100),
          timing: '손절가 하회 시',
          reason: '리스크 관리'
        }
      },
      phase2: {
        bullish: {
          condition: `${Math.floor((entryPrice + targetPrice1) / 2).toLocaleString()}원 돌파`,
          action: '시드의 30% 추가 진입',
          actionRatio: 30,
          reason: '추세 강화 확인'
        },
        sideways: {
          condition: `${Math.floor(entryPrice * 0.98).toLocaleString()}원 ~ ${Math.floor(entryPrice * 1.02).toLocaleString()}원 박스권`,
          action: '현재 포지션 유지',
          reason: '방향성 불명확'
        },
        bearish: {
          condition: `${stopLossPrice.toLocaleString()}원 하회`,
          action: '포지션의 50% 청산',
          exitRatio: 50,
          reason: '하락 추세 확정'
        }
      },
      phase3: {
        target1: {
          price: `${targetPrice1.toLocaleString()}원`,
          action: `포지션의 50% 익절`,
          exitRatio: 50,
          reason: '1차 목표 달성'
        },
        target2: {
          price: `${targetPrice2.toLocaleString()}원`,
          action: `포지션의 30% 추가 익절`,
          exitRatio: 30,
          reason: '2차 목표 달성'
        }
      }
    };
  }

  // 🆕 투자 전략 파싱 함수 (레거시, 사용 안 함)
  private parseInvestmentStrategy(content: string, entryPrice: number): any {
    try {
      // 5번 섹션 찾기
      const strategySectionMatch = content.match(/5\.\s+.*맞춤\s*투자\s*전략[\s\S]*?(?=━━|※|$)/);
      if (!strategySectionMatch) {
        console.warn('⚠️ 전략 섹션을 찾을 수 없습니다');
        return null;
      }
      
      const strategyContent = strategySectionMatch[0];
      console.log('✅ 전략 섹션 찾음, 길이:', strategyContent.length);
      
      // 초기 진입 파싱 (확장된 정규식 - 여러 변형 형식 지원)
      // 진입비율: 여러 형식 지원 (예: "진입비율: 40%", "진입 비율: 40%", "진입비율 40%")
      const entryRatioMatch = strategyContent.match(/진입\s*비율\s*:?\s*(\d+)\s*%/i) || 
                            strategyContent.match(/진입비율\s*:?\s*(\d+)\s*%/i) ||
                            strategyContent.match(/진입\s*(\d+)\s*%/i);
      
      // 진입타이밍: 여러 형식 지원
      const entryTimingMatch = strategyContent.match(/진입\s*타이밍\s*:?\s*([^\n]+(?:\n(?!근거:|손절가:|⚠️|\[2~3일차|\[2~3주차|상승 시나리오:|━━)[^\n]+)*)/i) ||
                              strategyContent.match(/진입\s*시점\s*:?\s*([^\n]+(?:\n(?!근거:|손절가:|⚠️|\[2~3일차|\[2~3주차|상승 시나리오:|━━)[^\n]+)*)/i);
      
      // 근거: 여러 형식 지원
      const reasoningMatch = strategyContent.match(/근거\s*:?\s*([\s\S]*?)(?=손절가:|⚠️|\[2~3일차|\[2~3주차|상승 시나리오:|━━|$)/i) ||
                            strategyContent.match(/이유\s*:?\s*([\s\S]*?)(?=손절가:|⚠️|\[2~3일차|\[2~3주차|상승 시나리오:|━━|$)/i);
      
      console.log('🔍 Phase1 파싱 결과:', {
        entryRatioMatch: !!entryRatioMatch,
        entryTimingMatch: !!entryTimingMatch,
        reasoningMatch: !!reasoningMatch
      });
      
      // 손절 정보 파싱 (확장된 정규식)
      const stopLossPriceMatch = strategyContent.match(/손절가\s*:?\s*([\d,]+)\s*원/i) ||
                                 strategyContent.match(/손절\s*가격\s*:?\s*([\d,]+)\s*원/i);
      const stopLossPercentMatch = strategyContent.match(/손절가\s*:?\s*[\d,]+\s*원\s*\(([^)]+)\)/i) ||
                                   strategyContent.match(/손절가\s*:?\s*[\d,]+\s*원\s*[\(（]([^)]+)[\)）]/i);
      const stopLossTimingMatch = strategyContent.match(/손절\s*타이밍\s*:?\s*([^\n]+)/i) ||
                                  strategyContent.match(/손절\s*시점\s*:?\s*([^\n]+)/i);
      const stopLossReasonMatch = strategyContent.match(/손절\s*사유\s*:?\s*([\s\S]*?)(?=\[2~3일차|\[2~3주차|상승 시나리오:|횡보 시나리오:|하락 시나리오:|━━|$)/i) ||
                                  strategyContent.match(/손절\s*이유\s*:?\s*([\s\S]*?)(?=\[2~3일차|\[2~3주차|상승 시나리오:|횡보 시나리오:|하락 시나리오:|━━|$)/i);
      
      // 상황별 대응 파싱 (확장된 정규식 - 여러 변형 형식 지원)
      const bullishMatch = strategyContent.match(/상승\s*시나리오\s*:?\s*조건\s*:?\s*([^\n]+)[\s\S]*?액션\s*:?\s*([^\n]+(?:\n(?!근거:|횡보 시나리오:|하락 시나리오:|\[5~7일차|\[4주차|━━)[^\n]+)*)[\s\S]*?근거\s*:?\s*([\s\S]*?)(?=횡보 시나리오:|하락 시나리오:|\[5~7일차|\[4주차|━━|$)/i) ||
                       strategyContent.match(/상승\s*상황\s*:?\s*조건\s*:?\s*([^\n]+)[\s\S]*?액션\s*:?\s*([^\n]+(?:\n(?!근거:|횡보 시나리오:|하락 시나리오:|\[5~7일차|\[4주차|━━)[^\n]+)*)[\s\S]*?근거\s*:?\s*([\s\S]*?)(?=횡보 시나리오:|하락 시나리오:|\[5~7일차|\[4주차|━━|$)/i);
      
      const sidewaysMatch = strategyContent.match(/횡보\s*시나리오\s*:?\s*조건\s*:?\s*([^\n]+)[\s\S]*?액션\s*:?\s*([^\n]+(?:\n(?!근거:|하락 시나리오:|\[5~7일차|\[4주차|━━)[^\n]+)*)[\s\S]*?근거\s*:?\s*([\s\S]*?)(?=하락 시나리오:|\[5~7일차|\[4주차|━━|$)/i) ||
                        strategyContent.match(/횡보\s*상황\s*:?\s*조건\s*:?\s*([^\n]+)[\s\S]*?액션\s*:?\s*([^\n]+(?:\n(?!근거:|하락 시나리오:|\[5~7일차|\[4주차|━━)[^\n]+)*)[\s\S]*?근거\s*:?\s*([\s\S]*?)(?=하락 시나리오:|\[5~7일차|\[4주차|━━|$)/i);
      
      const bearishMatch = strategyContent.match(/하락\s*시나리오\s*:?\s*조건\s*:?\s*([^\n]+)[\s\S]*?액션\s*:?\s*([^\n]+(?:\n(?!근거:|\[5~7일차|\[4주차|━━)[^\n]+)*)[\s\S]*?근거\s*:?\s*([\s\S]*?)(?=\[5~7일차|\[4주차|━━|$)/i) ||
                      strategyContent.match(/하락\s*상황\s*:?\s*조건\s*:?\s*([^\n]+)[\s\S]*?액션\s*:?\s*([^\n]+(?:\n(?!근거:|\[5~7일차|\[4주차|━━)[^\n]+)*)[\s\S]*?근거\s*:?\s*([\s\S]*?)(?=\[5~7일차|\[4주차|━━|$)/i);
      
      // 수익 실현 파싱 (확장된 정규식)
      const target1ExitMatch = strategyContent.match(/1차\s*목표\s*달성\s*시\s*:?\s*가격\s*:?\s*([^\n]+)[\s\S]*?액션\s*:?\s*([^\n]+(?:\n(?!근거:|2차 목표 달성 시:|추가 전략:|━━)[^\n]+)*)[\s\S]*?근거\s*:?\s*([\s\S]*?)(?=2차 목표 달성 시:|추가 전략:|━━|$)/i) ||
                            strategyContent.match(/1차\s*목표\s*:?\s*가격\s*:?\s*([^\n]+)[\s\S]*?액션\s*:?\s*([^\n]+(?:\n(?!근거:|2차 목표 달성 시:|추가 전략:|━━)[^\n]+)*)[\s\S]*?근거\s*:?\s*([\s\S]*?)(?=2차 목표 달성 시:|추가 전략:|━━|$)/i);
      
      const target2ExitMatch = strategyContent.match(/2차\s*목표\s*달성\s*시\s*:?\s*가격\s*:?\s*([^\n]+)[\s\S]*?액션\s*:?\s*([^\n]+(?:\n(?!근거:|추가 전략:|━━)[^\n]+)*)[\s\S]*?근거\s*:?\s*([\s\S]*?)(?=추가 전략:|━━|$)/i) ||
                            strategyContent.match(/2차\s*목표\s*:?\s*가격\s*:?\s*([^\n]+)[\s\S]*?액션\s*:?\s*([^\n]+(?:\n(?!근거:|추가 전략:|━━)[^\n]+)*)[\s\S]*?근거\s*:?\s*([\s\S]*?)(?=추가 전략:|━━|$)/i);
      
      const additionalMatch = strategyContent.match(/추가\s*전략\s*:?\s*([\s\S]*?)(?=━━|※|$)/i) ||
                             strategyContent.match(/기타\s*전략\s*:?\s*([\s\S]*?)(?=━━|※|$)/i);
      
      // Phase3 파싱
      console.log('🔍 Phase3 파싱 결과:', {
        target1ExitMatch: !!target1ExitMatch,
        target2ExitMatch: !!target2ExitMatch,
        additionalMatch: !!additionalMatch
      });

      const strategy: any = {};

      // Phase1 파싱 (기본값 설정으로 불완전한 strategy 방지)
      if (entryRatioMatch) {
        const entryRatio = parseInt(entryRatioMatch[1]);
        let entryTiming = entryTimingMatch ? entryTimingMatch[1].trim() : '';
        // "근거:" 이후 텍스트 제거
        if (entryTiming.includes('근거:')) {
          entryTiming = entryTiming.split('근거:')[0].trim();
        }
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';
        
        let stopLoss: any = null;
        if (stopLossPriceMatch || stopLossTimingMatch || stopLossReasonMatch) {
          const stopLossPrice = stopLossPriceMatch ? parseInt(stopLossPriceMatch[1].replace(/,/g, '')) : null;
          const stopLossPercentStr = stopLossPercentMatch ? stopLossPercentMatch[1] : '';
          const stopLossPercent = parseFloat(stopLossPercentStr.match(/-?([\d.]+)%/)?.[1] || '0');
          const stopLossTiming = stopLossTimingMatch ? stopLossTimingMatch[1].trim() : '';
          const stopLossReason = stopLossReasonMatch ? stopLossReasonMatch[1].trim() : '';
          
          if (stopLossPrice) {
            stopLoss = {
            price: stopLossPrice,
            percent: -Math.abs(stopLossPercent),
              timing: stopLossTiming,
              reason: stopLossReason
            };
          }
        }
        
        strategy.phase1 = {
          entryRatio,
          entryTiming,
          reasoning,
          stopLoss
        };
        
        console.log('✅ Phase1 파싱 성공:', {
          entryRatio,
          hasEntryTiming: !!entryTiming,
          hasReasoning: !!reasoning,
          hasStopLoss: !!stopLoss
        });
      } else {
        // Phase1 파싱 실패 시 기본값 설정 (Fallback 방지)
        console.warn('⚠️ Phase1 파싱 실패: entryRatioMatch 없음, 기본값 사용', {
          entryRatioMatch: !!entryRatioMatch,
          strategyContentPreview: strategyContent.substring(0, 1000)
        });
        // 기본값으로 phase1 생성 (최소한의 구조 유지)
        strategy.phase1 = {
          entryRatio: 30, // 기본 진입비율
          entryTiming: '현재가 부근에서 분할 진입',
          reasoning: 'AI 응답 파싱 실패로 기본값 사용',
          stopLoss: null
        };
      }

      // Phase2 파싱
      console.log('🔍 Phase2 파싱 결과:', {
        bullishMatch: !!bullishMatch,
        sidewaysMatch: !!sidewaysMatch,
        bearishMatch: !!bearishMatch
      });

      if (bullishMatch || sidewaysMatch || bearishMatch) {
        strategy.phase2 = {};
        
        if (bullishMatch) {
          // 액션에서 "→" 이후만 추출 (예: "15,079원 돌파 시 → 시드의 30% 추가 진입" → "시드의 30% 추가 진입")
          let actionText = bullishMatch[2].trim();
          // "→" 이후만 추출
          if (actionText.includes('→')) {
            actionText = actionText.split('→').slice(1).join('→').trim();
          }
          // JSON 문자열 제거 (혹시 모를 경우)
          actionText = actionText.replace(/\{[\s\S]*?\}/g, '').trim();
          const ratioMatch = actionText.match(/시드의\s*(\d+)%|(\d+)%\s*추가/);
          const actionRatio = ratioMatch ? parseInt(ratioMatch[1] || ratioMatch[2]) : 0;
          
          // 조건에서 가격 추출 (검증용)
          const conditionText = bullishMatch[1].trim();
          const conditionPriceMatch = conditionText.match(/([\d,]+)원/);
          const conditionPrice = conditionPriceMatch ? parseInt(conditionPriceMatch[1].replace(/,/g, '')) : null;
          
          strategy.phase2.bullish = {
            condition: conditionText,
            action: actionText, // "→" 이후 액션만 포함
            actionRatio,
            reason: bullishMatch[3].trim(),
            _conditionPrice: conditionPrice // 검증용 (나중에 phase3와 비교)
          };
        }
        
        if (sidewaysMatch) {
          // 액션에서 "→" 이후만 추출
          let actionText = sidewaysMatch[2].trim();
          if (actionText.includes('→')) {
            actionText = actionText.split('→').slice(1).join('→').trim();
          }
          actionText = actionText.replace(/\{[\s\S]*?\}/g, '').trim();
          
          strategy.phase2.sideways = {
            condition: sidewaysMatch[1].trim(),
            action: actionText,
            reason: sidewaysMatch[3].trim()
          };
        }
        
        if (bearishMatch) {
          // 액션에서 "→" 이후만 추출 (예: "56,939원 하회 시 → 포지션의 50% 청산" → "포지션의 50% 청산")
          let actionText = bearishMatch[2].trim();
          if (actionText.includes('→')) {
            actionText = actionText.split('→').slice(1).join('→').trim();
          }
          actionText = actionText.replace(/\{[\s\S]*?\}/g, '').trim();
          const ratioMatch = actionText.match(/포지션의\s*(\d+)%|(\d+)%\s*청산/);
          const exitRatio = ratioMatch ? parseInt(ratioMatch[1] || ratioMatch[2]) : 100; // 기본값 100% (전량 청산)
          
          strategy.phase2.bearish = {
            condition: bearishMatch[1].trim(),
            action: actionText, // "→" 이후 액션만 포함
            exitRatio,
            reason: bearishMatch[3].trim()
          };
        }
      } else {
        // Phase2 파싱 실패 시 기본값 설정
        console.warn('⚠️ Phase2 파싱 실패: 시나리오 매칭 없음, 기본값 사용');
        strategy.phase2 = {
          bullish: { condition: '가격 상승 시', action: '추가 진입 검토', reason: 'AI 응답 파싱 실패' },
          sideways: { condition: '횡보 지속 시', action: '현재 포지션 유지', reason: 'AI 응답 파싱 실패' },
          bearish: { condition: '가격 하락 시', action: '리스크 관리', reason: 'AI 응답 파싱 실패' }
        };
      }

      if (target1ExitMatch || target2ExitMatch) {
        strategy.phase3 = {};
        
        if (target1ExitMatch) {
          // 액션에서 "→" 이후만 추출 및 불필요한 텍스트 제거
          let actionText = target1ExitMatch[2].trim();
          // "1차 목표 달성 시: 가격: 60,461원 액션: ..." 같은 형식에서 "액션:" 이후만 추출
          if (actionText.includes('액션:')) {
            actionText = actionText.split('액션:').slice(1).join('액션:').trim();
          }
          // 가격 정보 제거 (예: "60,461원 달성 시" 제거)
          actionText = actionText.replace(/[\d,]+원\s*(?:달성\s*시|돌파|하회)?\s*→?\s*/g, '').trim();
          // "→" 이후만 추출
          if (actionText.includes('→')) {
            actionText = actionText.split('→').slice(1).join('→').trim();
          }
          actionText = actionText.replace(/\{[\s\S]*?\}/g, '').trim();
          const ratioMatch = actionText.match(/포지션의\s*(\d+)%|(\d+)%\s*익절/);
          const exitRatio = ratioMatch ? parseInt(ratioMatch[1] || ratioMatch[2]) : 0;
          
          // 가격 추출 (검증용)
          const priceText = target1ExitMatch[1].trim();
          const priceMatch = priceText.match(/([\d,]+)원/);
          const targetPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
          
          // 🚨 검증: phase2.bullish 조건 가격과 같은지 확인
          if (strategy.phase2?.bullish?._conditionPrice && targetPrice && 
              Math.abs(strategy.phase2.bullish._conditionPrice - targetPrice) < 100) {
            console.warn('⚠️ 경고: 2~3일차 상승 시나리오 조건 가격과 1차 목표가가 거의 같습니다!', {
              phase2ConditionPrice: strategy.phase2.bullish._conditionPrice,
              phase3TargetPrice: targetPrice,
              difference: Math.abs(strategy.phase2.bullish._conditionPrice - targetPrice)
            });
            // phase2 조건 가격을 조정 (1차 목표가보다 낮게)
            if (targetPrice && entryPrice) {
              const adjustedPrice = Math.floor((entryPrice + targetPrice) / 2);
              strategy.phase2.bullish.condition = strategy.phase2.bullish.condition.replace(
                /([\d,]+)원/,
                `${adjustedPrice.toLocaleString()}원`
              );
              strategy.phase2.bullish._conditionPrice = adjustedPrice;
              console.log('✅ 2~3일차 상승 시나리오 조건 가격을 자동 조정:', adjustedPrice.toLocaleString(), '원');
            }
          }
          
          strategy.phase3.target1 = {
            price: priceText,
            action: actionText, // 깨끗한 액션만 포함
            exitRatio,
            reason: target1ExitMatch[3].trim()
          };
        }
        
        if (target2ExitMatch) {
          // 액션에서 "→" 이후만 추출 및 불필요한 텍스트 제거
          let actionText = target2ExitMatch[2].trim();
          // "2차 목표 달성 시: 가격: 61,635원 액션: ..." 같은 형식에서 "액션:" 이후만 추출
          if (actionText.includes('액션:')) {
            actionText = actionText.split('액션:').slice(1).join('액션:').trim();
          }
          // 가격 정보 제거
          actionText = actionText.replace(/[\d,]+원\s*(?:달성\s*시|돌파|하회)?\s*→?\s*/g, '').trim();
          // "→" 이후만 추출
          if (actionText.includes('→')) {
            actionText = actionText.split('→').slice(1).join('→').trim();
          }
          actionText = actionText.replace(/\{[\s\S]*?\}/g, '').trim();
          const ratioMatch = actionText.match(/포지션의\s*(\d+)%|(\d+)%\s*익절/);
          const exitRatio = ratioMatch ? parseInt(ratioMatch[1] || ratioMatch[2]) : 0;
          
          strategy.phase3.target2 = {
            price: target2ExitMatch[1].trim(),
            action: actionText, // 깨끗한 액션만 포함
            exitRatio,
            reason: target2ExitMatch[3].trim()
          };
        }
        
        if (additionalMatch) {
          strategy.phase3.additional = additionalMatch[1].trim();
        }
      } else {
        // Phase3 파싱 실패 시 기본값 설정
        console.warn('⚠️ Phase3 파싱 실패: 목표 달성 매칭 없음, 기본값 사용');
        strategy.phase3 = {
          target1: { price: '1차 목표가', action: '부분 익절', reason: 'AI 응답 파싱 실패' },
          target2: { price: '2차 목표가', action: '추가 익절', reason: 'AI 응답 파싱 실패' }
        };
      }

      if (Object.keys(strategy).length > 0) {
        console.log('✅ 전략 파싱 성공:', {
          phase1: !!strategy.phase1,
          phase2: !!strategy.phase2,
          phase3: !!strategy.phase3,
          phase1Keys: strategy.phase1 ? Object.keys(strategy.phase1) : [],
          phase2Keys: strategy.phase2 ? Object.keys(strategy.phase2) : [],
          phase3Keys: strategy.phase3 ? Object.keys(strategy.phase3) : [],
          fullStrategy: JSON.stringify(strategy, null, 2)
        });
        
        // 모든 Phase가 있어야 완전한 전략
        if (!strategy.phase1 || !strategy.phase2 || !strategy.phase3) {
          console.warn('⚠️ 전략 파싱 불완전:', {
            phase1: !!strategy.phase1,
            phase2: !!strategy.phase2,
            phase3: !!strategy.phase3,
            phase1Details: strategy.phase1,
            phase2Details: strategy.phase2,
            phase3Details: strategy.phase3
          });
        }
        
        return strategy;
      } else {
        console.warn('⚠️ 전략 파싱 실패: 파싱된 섹션이 없습니다', {
          entryRatioMatch: !!entryRatioMatch,
          bullishMatch: !!bullishMatch,
          sidewaysMatch: !!sidewaysMatch,
          bearishMatch: !!bearishMatch,
          target1ExitMatch: !!target1ExitMatch,
          target2ExitMatch: !!target2ExitMatch,
          strategyContentPreview: strategyContent.substring(0, 500) // 처음 500자만 출력
        });
        return null;
      }
    } catch (error) {
      console.error('Strategy parsing error:', error);
      return null;
    }
  }
}



