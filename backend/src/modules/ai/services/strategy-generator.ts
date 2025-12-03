/**
 * 투자 전략 생성 서비스
 * Phase 1 리팩터링: 명확한 파이프라인과 추적 가능한 결과
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  StrategyResult,
  StrategySource,
  InvestmentStrategy,
  StrategyGenerationContext,
  Phase1Strategy,
  Phase2Strategy,
  Phase3Strategy,
} from '../types/strategy-types';
import {
  TRADING_STRATEGY_CONFIG,
  getAdjustedTargets,
} from '../../../config/trading-strategy.config';
import { StrategyValidator } from '../validators/strategy.validator';
import { MonitoringService } from './monitoring.service';
import { SYSTEM_PROMPT, buildStrategyPrompt, getPromptSummary } from '../templates/prompt-templates';

@Injectable()
export class StrategyGenerator {
  private readonly logger = new Logger(StrategyGenerator.name);
  private openai: OpenAI | null = null;

  constructor(
    private configService: ConfigService,
    private monitoringService: MonitoringService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('✅ OpenAI 클라이언트 초기화 성공');
    } else {
      this.logger.warn('⚠️ OPENAI_API_KEY 없음 - 규칙 기반 전략만 사용 가능');
    }
  }

  /**
   * 메인 전략 생성 메서드
   * 파이프라인: AI 시도 → 규칙 기반 → Fallback
   */
  async generateStrategy(
    context: StrategyGenerationContext,
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const attemptedSources: StrategySource[] = [];

    this.logger.log(
      `🎯 전략 생성 시작: ${context.symbol.name} (${context.investmentPeriod})`,
    );

    // 1단계: AI 전략 시도 (OpenAI 사용 가능한 경우)
    if (this.openai) {
      attemptedSources.push('ai');
      this.logger.debug('📡 AI 전략 생성 시도...');

      const aiResult = await this.tryAiStrategy(context);
      if (aiResult.success && aiResult.strategy) {
        const generationTime = Date.now() - startTime;
        this.logger.log(
          `✅ AI 전략 생성 성공 (${generationTime}ms, 신뢰도: ${aiResult.confidence})`,
        );

        const finalResult = {
          ...aiResult,
          metadata: {
            ...aiResult.metadata,
            generationTime,
            attemptedSources,
          },
        };

        // 모니터링 추적
        this.monitoringService.trackStrategyGeneration(finalResult);

        return finalResult;
      }

      this.logger.warn(
        `⚠️ AI 전략 생성 실패: ${aiResult.errors?.join(', ') || '알 수 없는 오류'}`,
      );
      
      // 실패도 추적
      this.monitoringService.trackStrategyGeneration(aiResult);
    } else {
      this.logger.debug('⏭️ AI 전략 스킵 (OpenAI 키 없음)');
    }

    // 2단계: 규칙 기반 전략 (기술적 지표 분석)
    attemptedSources.push('rule-based');
    this.logger.debug('📊 규칙 기반 전략 생성 시도...');

    const ruleResult = this.generateRuleBasedStrategy(context);
    const generationTime = Date.now() - startTime;

    this.logger.log(
      `✅ 규칙 기반 전략 생성 완료 (${generationTime}ms, 신뢰도: ${ruleResult.confidence})`,
    );

    const finalResult = {
      ...ruleResult,
      metadata: {
        ...ruleResult.metadata,
        generationTime,
        attemptedSources,
      },
    };

    // 모니터링 추적
    this.monitoringService.trackStrategyGeneration(finalResult);

    return finalResult;
  }

  /**
   * AI 전략 생성 시도
   */
  private async tryAiStrategy(
    context: StrategyGenerationContext,
  ): Promise<StrategyResult> {
    if (!this.openai) {
      return {
        success: false,
        source: 'ai',
        confidence: 0,
        metadata: {
          generationTime: 0,
          validationPassed: false,
          attemptedSources: [],
        },
        errors: ['OpenAI 클라이언트 없음'],
      };
    }

    const startTime = Date.now();

    try {
      // AI 프롬프트 생성 (최적화된 템플릿 사용)
      const prompt = buildStrategyPrompt(context);
      const promptSummary = getPromptSummary(prompt);
      
      this.logger.debug(
        `프롬프트: ${promptSummary.lines}줄, ~${promptSummary.estimatedTokens} 토큰`,
      );

      // OpenAI API 호출
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500, // 2000 → 1500 (응답도 최적화)
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0].message.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;

      // JSON 파싱
      let parsedStrategy: any;
      try {
        parsedStrategy = JSON.parse(responseContent);
      } catch (parseError) {
        return {
          success: false,
          source: 'ai',
          confidence: 0,
          metadata: {
            generationTime: Date.now() - startTime,
            aiModel: 'gpt-4o-mini',
            tokensUsed,
            validationPassed: false,
            attemptedSources: [],
          },
          errors: ['JSON 파싱 실패: ' + parseError.message],
        };
      }

      // Zod 검증 (자동 수정 활성화)
      const validation = StrategyValidator.validate(parsedStrategy, true);
      
      if (!validation.success) {
        this.logger.warn(
          `AI 전략 검증 실패: ${validation.errors?.join(', ')}`,
        );
        return {
          success: false,
          source: 'ai',
          confidence: 0,
          metadata: {
            generationTime: Date.now() - startTime,
            aiModel: 'gpt-4o-mini',
            tokensUsed,
            validationPassed: false,
            validationErrors: validation.errors,
            attemptedSources: [],
          },
          errors: validation.errors,
        };
      }

      // 성공 (자동 수정 포함)
      const confidence = validation.fixed ? 0.8 : 0.9; // 수정된 경우 신뢰도 약간 낮춤
      
      if (validation.fixed) {
        this.logger.log(
          `⚙️ AI 전략 자동 수정 완료 (${validation.fixedFields?.join(', ')})`,
        );
      }

      return {
        success: true,
        strategy: validation.data as InvestmentStrategy,
        source: 'ai',
        confidence,
        metadata: {
          generationTime: Date.now() - startTime,
          aiModel: 'gpt-4o-mini',
          tokensUsed,
          validationPassed: true,
          validationErrors: validation.fixed ? validation.fixedFields : undefined,
          attemptedSources: [],
        },
      };
    } catch (error) {
      this.logger.error('AI 전략 생성 중 오류:', error);
      return {
        success: false,
        source: 'ai',
        confidence: 0,
        metadata: {
          generationTime: Date.now() - startTime,
          validationPassed: false,
          attemptedSources: [],
        },
        errors: [error.message || '알 수 없는 오류'],
      };
    }
  }

  /**
   * 규칙 기반 전략 생성 (기술적 지표 분석)
   */
  private generateRuleBasedStrategy(
    context: StrategyGenerationContext,
  ): StrategyResult {
    const startTime = Date.now();

    try {
      const {
        latestCandle,
        latestIndicator,
        entryPrice,
        targetPrice1,
        targetPrice2,
        stopLossPrice,
        investmentPeriod,
        symbol,
      } = context;

      const currentPrice = latestCandle.close;
      const rsi = latestIndicator?.rsi || 50;
      const macd = latestIndicator?.macd || 0;
      const macdSignal = latestIndicator?.macdSignal || 0;
      const macdHistogram = macd - macdSignal;
      const ma20 = latestIndicator?.ma20 || currentPrice;
      const ma60 = latestIndicator?.ma60 || currentPrice;

      // 1. Phase 1: 초기 진입 전략
      let entryRatio = 30; // 기본값
      if (rsi > 55 && macdHistogram > 0) {
        entryRatio = 40; // 강한 매수 신호
      } else if (rsi > 50 && macdHistogram > 0) {
        entryRatio = 35; // 중간 매수 신호
      } else if (rsi < 45 || macdHistogram < 0) {
        entryRatio = 25; // 약한 신호
      }

      const phase1: Phase1Strategy = {
        entryRatio,
        entryTiming: `현재가 ${currentPrice.toLocaleString()}원에서 ${entryRatio}% 진입`,
        reasoning: this.buildReasoning(
          rsi,
          macd,
          macdSignal,
          currentPrice,
          ma20,
          ma60,
          latestIndicator?.volumeRatio || 1,
        ),
        stopLoss: {
          price: stopLossPrice,
          percent: parseFloat(
            (((stopLossPrice - entryPrice) / entryPrice) * 100).toFixed(1),
          ),
          timing: `${stopLossPrice.toLocaleString()}원 하회 시 손절`,
          reason: `기술적 지지선 ${stopLossPrice.toLocaleString()}원 이하 하락 시 추가 하락 가능성 높음`,
        },
      };

      // 2. Phase 2: 시장 상황별 대응
      const midPrice = Math.floor((currentPrice + targetPrice1) / 2);
      const phase2: Phase2Strategy = {
        bullish: {
          condition: `${midPrice.toLocaleString()}원 돌파 AND RSI 55 이상`,
          action: `시드의 30% 추가 진입`,
          actionRatio: 30,
          reason: `가격 상승 모멘텀 확인 시 추가 진입으로 수익 극대화`,
        },
        sideways: {
          condition: `${Math.floor(currentPrice * 0.98).toLocaleString()}~${Math.floor(currentPrice * 1.02).toLocaleString()}원 박스권 2일 이상`,
          action: `현재 포지션 유지 및 관망`,
          reason: `방향성 불명확 시 추가 신호 대기`,
        },
        bearish: {
          condition: `${stopLossPrice.toLocaleString()}원 하회 OR MACD 지속 하락`,
          action: `포지션의 70% 청산`,
          exitRatio: 70,
          reason: `하락 추세 확정 시 손실 최소화`,
        },
      };

      // 3. Phase 3: 목표가 도달 시
      const phase3: Phase3Strategy = {
        target1: {
          price: `${targetPrice1.toLocaleString()}원`,
          action: `포지션의 50% 익절`,
          exitRatio: 50,
          reason: `1차 목표 달성 시 수익 일부 실현`,
        },
        target2: {
          price: `${targetPrice2.toLocaleString()}원`,
          action: `잔여 포지션 전량 익절`,
          exitRatio: 100,
          reason: `2차 목표 달성 시 전체 수익 실현`,
        },
      };

      const strategy: InvestmentStrategy = {
        phase1,
        phase2,
        phase3,
      };

      return {
        success: true,
        strategy,
        source: 'rule-based',
        confidence: 0.6, // 규칙 기반은 중간 신뢰도
        metadata: {
          generationTime: Date.now() - startTime,
          ruleVersion: '1.0.0',
          validationPassed: true,
          attemptedSources: [],
        },
      };
    } catch (error) {
      this.logger.error('규칙 기반 전략 생성 중 오류:', error);

      // Fallback으로 전환
      return this.generateFallbackStrategy(context);
    }
  }

  /**
   * Fallback 전략 (최소한의 기본 전략)
   */
  private generateFallbackStrategy(
    context: StrategyGenerationContext,
  ): StrategyResult {
    const {
      entryPrice,
      targetPrice1,
      targetPrice2,
      stopLossPrice,
      investmentPeriod,
    } = context;

    const periodMap = {
      swing: '3~7일',
      medium: '2~4주',
      long: '1~3개월',
    };

    const strategy: InvestmentStrategy = {
      phase1: {
        entryRatio: 30,
        entryTiming: `현재가에서 30% 진입`,
        reasoning: `${periodMap[investmentPeriod]} ${investmentPeriod} 전략 기본 설정`,
        stopLoss: {
          price: stopLossPrice,
          percent: parseFloat(
            (((stopLossPrice - entryPrice) / entryPrice) * 100).toFixed(1),
          ),
          timing: `손절가 하회 시`,
          reason: `리스크 관리를 위한 손절`,
        },
      },
      phase2: {
        bullish: {
          condition: `가격 상승 시`,
          action: `포지션의 20% 추가 진입`,
          actionRatio: 20,
          reason: `상승 추세 확인 시 추가 진입`,
        },
        sideways: {
          condition: `횡보 시`,
          action: `현재 포지션 유지`,
          reason: `방향성 불명확 시 관망`,
        },
        bearish: {
          condition: `손절가 하회 시`,
          action: `전량 청산`,
          exitRatio: 100,
          reason: `손실 최소화`,
        },
      },
      phase3: {
        target1: {
          price: `${targetPrice1.toLocaleString()}원`,
          action: `포지션의 50% 익절`,
          exitRatio: 50,
          reason: `1차 목표 달성 시 수익 실현`,
        },
        target2: {
          price: `${targetPrice2.toLocaleString()}원`,
          action: `잔여 포지션 전량 익절`,
          exitRatio: 100,
          reason: `2차 목표 달성 시 전체 익절`,
        },
      },
    };

    return {
      success: true,
      strategy,
      source: 'fallback',
      confidence: 0.3, // Fallback은 낮은 신뢰도
      metadata: {
        generationTime: 0,
        validationPassed: true,
        attemptedSources: [],
      },
    };
  }



  /**
   * 근거 생성 (규칙 기반)
   */
  private buildReasoning(
    rsi: number,
    macd: number,
    macdSignal: number,
    currentPrice: number,
    ma20: number,
    ma60: number,
    volumeRatio: number,
  ): string {
    const rsiStatus = rsi > 70 ? '과매수' : rsi < 30 ? '과매도' : '중립';
    const macdDirection = macd > macdSignal ? '상향돌파' : '하향돌파';
    const maAlignment =
      currentPrice > ma20 && ma20 > ma60
        ? '정배열(상승)'
        : currentPrice < ma20 && ma20 < ma60
          ? '역배열(하락)'
          : '혼조';
    const volumeStatus = volumeRatio > 1.5 ? '급증' : volumeRatio > 1.0 ? '증가' : '감소';

    return `1) 기술적: RSI ${rsi.toFixed(2)}가 ${rsiStatus} 영역이며, MACD가 Signal을 ${macdDirection}하여 ${macd > macdSignal ? '매수' : '매도'} 신호를 나타냄.
2) 추세: 현재가 ${currentPrice.toLocaleString()}원이 MA20(${ma20.toFixed(0)}원)을 ${currentPrice > ma20 ? '상회' : '하회'}하며 이평선은 ${maAlignment} 상태.
3) 지지/저항: MA60(${ma60.toFixed(0)}원)이 주요 ${currentPrice > ma60 ? '지지선' : '저항선'}으로 작용 중.
4) 거래량: 평균 대비 ${(volumeRatio * 100).toFixed(0)}%로 ${volumeStatus}하여 ${volumeRatio > 1 ? '매수' : '매도'} 모멘텀을 ${volumeRatio > 1 ? '강화' : '약화'}.`;
  }
}

