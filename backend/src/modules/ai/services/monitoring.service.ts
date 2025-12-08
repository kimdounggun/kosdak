/**
 * AI 성능 모니터링 서비스
 * Phase 1-3: 실시간 성능 추적 및 알림
 */

import { Injectable, Logger } from '@nestjs/common';
import { StrategyResult } from '../types/strategy-types';

interface PerformanceMetrics {
  aiGeneration: {
    totalAttempts: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgGenerationTime: number;
    totalTokensUsed: number;
  };
  ruleBasedGeneration: {
    totalAttempts: number;
    avgGenerationTime: number;
  };
  fallbackUsage: {
    totalAttempts: number;
  };
  validation: {
    totalValidations: number;
    passedCount: number;
    failedCount: number;
    autoFixedCount: number;
    autoFixRate: number;
  };
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  // 메트릭 저장소 (메모리 기반, 추후 Redis로 이관 가능)
  private metrics: PerformanceMetrics = {
    aiGeneration: {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      avgGenerationTime: 0,
      totalTokensUsed: 0,
    },
    ruleBasedGeneration: {
      totalAttempts: 0,
      avgGenerationTime: 0,
    },
    fallbackUsage: {
      totalAttempts: 0,
    },
    validation: {
      totalValidations: 0,
      passedCount: 0,
      failedCount: 0,
      autoFixedCount: 0,
      autoFixRate: 0,
    },
  };

  private generationTimes: { ai: number[]; ruleBased: number[] } = {
    ai: [],
    ruleBased: [],
  };

  /**
   * 전략 생성 결과 추적
   */
  trackStrategyGeneration(result: StrategyResult): void {
    const { source, success, metadata } = result;

    // 출처별 통계
    if (source === 'ai') {
      this.metrics.aiGeneration.totalAttempts++;
      
      if (success) {
        this.metrics.aiGeneration.successCount++;
        
        // 생성 시간 추적
        if (metadata.generationTime) {
          this.generationTimes.ai.push(metadata.generationTime);
          this.metrics.aiGeneration.avgGenerationTime = this.calculateAverage(
            this.generationTimes.ai,
          );
        }
        
        // 토큰 사용량 추적
        if (metadata.tokensUsed) {
          this.metrics.aiGeneration.totalTokensUsed += metadata.tokensUsed;
        }
      } else {
        this.metrics.aiGeneration.failureCount++;
      }
      
      // 성공률 계산
      this.metrics.aiGeneration.successRate = parseFloat(
        (
          (this.metrics.aiGeneration.successCount /
            this.metrics.aiGeneration.totalAttempts) *
          100
        ).toFixed(2),
      );
    } else if (source === 'rule-based') {
      this.metrics.ruleBasedGeneration.totalAttempts++;
      
      if (metadata.generationTime) {
        this.generationTimes.ruleBased.push(metadata.generationTime);
        this.metrics.ruleBasedGeneration.avgGenerationTime =
          this.calculateAverage(this.generationTimes.ruleBased);
      }
    } else if (source === 'fallback') {
      this.metrics.fallbackUsage.totalAttempts++;
    }

    // 검증 통계
    if (metadata.validationPassed !== undefined) {
      this.metrics.validation.totalValidations++;
      
      if (metadata.validationPassed) {
        this.metrics.validation.passedCount++;
        
        // 자동 수정 여부
        if (metadata.validationErrors && metadata.validationErrors.length > 0) {
          this.metrics.validation.autoFixedCount++;
        }
      } else {
        this.metrics.validation.failedCount++;
      }
      
      // 자동 수정 성공률
      this.metrics.validation.autoFixRate = parseFloat(
        (
          (this.metrics.validation.autoFixedCount /
            this.metrics.validation.totalValidations) *
          100
        ).toFixed(2),
      );
    }

    // 경고 알림 (AI 실패율 30% 이상)
    if (
      this.metrics.aiGeneration.totalAttempts >= 10 &&
      this.metrics.aiGeneration.successRate < 70
    ) {
      this.logger.warn(
        `⚠️ AI 생성 실패율 높음: ${(100 - this.metrics.aiGeneration.successRate).toFixed(1)}% (${this.metrics.aiGeneration.failureCount}/${this.metrics.aiGeneration.totalAttempts})`,
      );
    }

    // 정보 로깅 (10회마다)
    if (
      (this.metrics.aiGeneration.totalAttempts +
        this.metrics.ruleBasedGeneration.totalAttempts +
        this.metrics.fallbackUsage.totalAttempts) %
        10 ===
      0
    ) {
      this.logMetricsSummary();
    }
  }

  /**
   * 메트릭 요약 로깅
   */
  logMetricsSummary(): void {
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('📊 전략 생성 성능 요약');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // AI 전략
    this.logger.log(
      `🤖 AI 전략: ${this.metrics.aiGeneration.successCount}/${this.metrics.aiGeneration.totalAttempts} (성공률 ${this.metrics.aiGeneration.successRate}%)`,
    );
    if (this.metrics.aiGeneration.avgGenerationTime > 0) {
      this.logger.log(
        `   - 평균 생성 시간: ${this.metrics.aiGeneration.avgGenerationTime.toFixed(0)}ms`,
      );
    }
    if (this.metrics.aiGeneration.totalTokensUsed > 0) {
      this.logger.log(
        `   - 총 토큰 사용: ${this.metrics.aiGeneration.totalTokensUsed.toLocaleString()} (평균 ${Math.round(this.metrics.aiGeneration.totalTokensUsed / this.metrics.aiGeneration.successCount)}/회)`,
      );
    }
    
    // 규칙 기반
    if (this.metrics.ruleBasedGeneration.totalAttempts > 0) {
      this.logger.log(
        `📊 규칙 기반: ${this.metrics.ruleBasedGeneration.totalAttempts}회 (평균 ${this.metrics.ruleBasedGeneration.avgGenerationTime.toFixed(0)}ms)`,
      );
    }
    
    // Fallback
    if (this.metrics.fallbackUsage.totalAttempts > 0) {
      this.logger.log(
        `⚙️ Fallback: ${this.metrics.fallbackUsage.totalAttempts}회`,
      );
    }
    
    // 검증
    this.logger.log(
      `✅ 검증: ${this.metrics.validation.passedCount}/${this.metrics.validation.totalValidations} 통과`,
    );
    if (this.metrics.validation.autoFixedCount > 0) {
      this.logger.log(
        `   - 자동 수정: ${this.metrics.validation.autoFixedCount}회 (${this.metrics.validation.autoFixRate}%)`,
      );
    }
    
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * 현재 메트릭 조회
   */
  getMetrics(): PerformanceMetrics {
    return JSON.parse(JSON.stringify(this.metrics)); // Deep clone
  }

  /**
   * 메트릭 초기화
   */
  resetMetrics(): void {
    this.metrics = {
      aiGeneration: {
        totalAttempts: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        avgGenerationTime: 0,
        totalTokensUsed: 0,
      },
      ruleBasedGeneration: {
        totalAttempts: 0,
        avgGenerationTime: 0,
      },
      fallbackUsage: {
        totalAttempts: 0,
      },
      validation: {
        totalValidations: 0,
        passedCount: 0,
        failedCount: 0,
        autoFixedCount: 0,
        autoFixRate: 0,
      },
    };
    this.generationTimes = { ai: [], ruleBased: [] };
    this.logger.log('🔄 메트릭 초기화 완료');
  }

  /**
   * 평균 계산
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    
    // 최근 100개만 유지 (메모리 절약)
    if (values.length > 100) {
      values.splice(0, values.length - 100);
    }
    
    return parseFloat(
      (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(2),
    );
  }

  /**
   * 비용 계산 (GPT-4o-mini 기준)
   */
  calculateCost(): { inputCost: number; outputCost: number; totalCost: number } {
    // GPT-4o-mini 가격: $0.150 / 1M input tokens, $0.600 / 1M output tokens
    // 평균 입력:출력 비율 1:3 가정
    const totalTokens = this.metrics.aiGeneration.totalTokensUsed;
    const inputTokens = totalTokens * 0.25; // 25% 입력
    const outputTokens = totalTokens * 0.75; // 75% 출력

    const inputCost = (inputTokens / 1_000_000) * 0.15;
    const outputCost = (outputTokens / 1_000_000) * 0.6;
    const totalCost = inputCost + outputCost;

    return {
      inputCost: parseFloat(inputCost.toFixed(4)),
      outputCost: parseFloat(outputCost.toFixed(4)),
      totalCost: parseFloat(totalCost.toFixed(4)),
    };
  }
}






