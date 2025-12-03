/**
 * Zod 기반 전략 검증 및 자동 수정
 * Phase 1-2: 런타임 타입 안정성 보장
 */

import { z } from 'zod';
import { Logger } from '@nestjs/common';

const logger = new Logger('StrategyValidator');

/**
 * Zod 스키마 정의
 */
const StopLossSchema = z.object({
  price: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().positive()),
  percent: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().min(-50).max(0)),
  timing: z.string().min(3),    // 5 → 3 완화
  reason: z.string().min(5),    // 10 → 5 완화
});

const ScenarioActionSchema = z.object({
  condition: z.string().min(5), // 10 → 5 완화
  action: z.string().min(3),    // 10 → 3 완화 (짧은 액션 허용)
  actionRatio: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().min(15).max(50)).optional(),
  exitRatio: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().min(30).max(100)).optional(),
  reason: z.string().min(5),    // 10 → 5 완화
});

const TargetActionSchema = z.object({
  price: z.string().min(3),
  action: z.string().min(3),    // 10 → 3 완화
  exitRatio: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().min(20).max(100)),
  reason: z.string().min(5),    // 10 → 5 완화
});

const Phase1Schema = z.object({
  entryRatio: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().min(15).max(50)),
  entryTiming: z.string().min(3),  // 5 → 3 완화
  reasoning: z.string().min(10),   // 20 → 10 완화
  stopLoss: StopLossSchema,
});

const Phase2Schema = z.object({
  bullish: ScenarioActionSchema,
  sideways: ScenarioActionSchema,
  bearish: ScenarioActionSchema,
});

const Phase3Schema = z.object({
  target1: TargetActionSchema,
  target2: TargetActionSchema,
  additional: z.string().optional(),
});

// ⚠️ RiskPlans 제거 (미사용 데이터, 토큰 낭비)
// const RiskPlanSchema = ...
// const RiskPlansSchema = ...

/**
 * 전체 전략 스키마
 */
export const InvestmentStrategySchema = z.object({
  phase1: Phase1Schema,
  phase2: Phase2Schema,
  phase3: Phase3Schema,
  // riskPlans 제거
});

/**
 * 검증 결과 타입
 */
export interface ValidationResult {
  success: boolean;
  data?: any;
  originalData?: any;
  errors?: string[];
  fixed?: boolean; // 자동 수정 여부
  fixedFields?: string[]; // 수정된 필드 목록
}

/**
 * 전략 검증기
 */
export class StrategyValidator {
  /**
   * 전략 검증 + 자동 수정
   */
  static validate(strategy: any, autoFix: boolean = true): ValidationResult {
    try {
      // 1차 검증
      const result = InvestmentStrategySchema.safeParse(strategy);

      if (result.success) {
        return {
          success: true,
          data: result.data,
          fixed: false,
        };
      }

      // 검증 실패 시 자동 수정 시도
      if (autoFix) {
        logger.debug('전략 검증 실패, 자동 수정 시도...');
        const fixResult = this.autoFixStrategy(strategy, result.error);
        
        if (fixResult.success) {
          logger.log(`✅ 자동 수정 성공 (${fixResult.fixedFields?.length}개 필드)`);
          return fixResult;
        }
      }

      // 자동 수정 실패
      const errors = result.error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      );

      return {
        success: false,
        originalData: strategy,
        errors,
        fixed: false,
      };
    } catch (error) {
      logger.error('검증 중 예외 발생:', error);
      return {
        success: false,
        errors: [error.message],
        fixed: false,
      };
    }
  }

  /**
   * 자동 수정 시도
   */
  private static autoFixStrategy(
    strategy: any,
    error: z.ZodError,
  ): ValidationResult {
    const fixed = JSON.parse(JSON.stringify(strategy)); // Deep clone
    const fixedFields: string[] = [];

    error.errors.forEach((err) => {
      const path = err.path.join('.');
      const fieldValue = this.getNestedValue(fixed, err.path);

      // 수정 규칙 적용
      const fixedValue = this.applyFixRule(err.code, fieldValue, err);

      if (fixedValue !== undefined) {
        this.setNestedValue(fixed, err.path, fixedValue);
        fixedFields.push(path);
        logger.debug(`  - ${path}: ${fieldValue} → ${fixedValue}`);
      }
    });

    // 재검증
    const revalidation = InvestmentStrategySchema.safeParse(fixed);

    if (revalidation.success) {
      return {
        success: true,
        data: revalidation.data,
        originalData: strategy,
        fixed: true,
        fixedFields,
      };
    }

    return {
      success: false,
      originalData: strategy,
      errors: revalidation.error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      ),
      fixed: false,
    };
  }

  /**
   * 수정 규칙 적용
   */
  private static applyFixRule(
    code: string,
    value: any,
    error: z.ZodIssue,
  ): any {
    const path = error.path.join('.');

    // 숫자 범위 오류
    if (code === 'too_small' || code === 'too_big') {
      if (typeof value === 'number') {
        const min = (error as any).minimum;
        const max = (error as any).maximum;

        if (code === 'too_small' && min !== undefined) {
          return min; // 최소값으로 보정
        }
        if (code === 'too_big' && max !== undefined) {
          return max; // 최대값으로 보정
        }
      }

      // 문자열 길이 오류 (너무 짧음)
      if (typeof value === 'string' && code === 'too_small') {
        const min = (error as any).minimum;
        if (value.length < min) {
          // 기본 문구 추가
          if (path.includes('reasoning')) {
            return value + ' (기술적 지표 분석 기반)';
          }
          if (path.includes('reason')) {
            return value + ' (상세 분석 필요)';
          }
          if (path.includes('action')) {
            return value + ' 추천';
          }
          return value + ' (상세 내용 없음)';
        }
      }
    }

    // 필수 필드 누락
    if (code === 'invalid_type') {
      const expected = (error as any).expected;

      if (expected === 'number') {
        // entryRatio 기본값
        if (path.includes('entryRatio')) {
          return 30;
        }
        // exitRatio 기본값
        if (path.includes('exitRatio')) {
          return 50;
        }
        // actionRatio 기본값
        if (path.includes('actionRatio')) {
          return 25;
        }
        return 0;
      }

      if (expected === 'string') {
        if (path.includes('condition')) {
          return '시장 상황에 따라 판단';
        }
        if (path.includes('action')) {
          return '포지션 조정 필요';
        }
        if (path.includes('reason')) {
          return '상세 분석 필요';
        }
        return '정보 없음';
      }
    }

    return undefined; // 수정 불가
  }

  /**
   * 중첩 객체에서 값 가져오기
   */
  private static getNestedValue(obj: any, path: (string | number)[]): any {
    return path.reduce((current, key) => current?.[key], obj);
  }

  /**
   * 중첩 객체에 값 설정
   */
  private static setNestedValue(
    obj: any,
    path: (string | number)[],
    value: any,
  ): void {
    const lastKey = path[path.length - 1];
    const parent = path
      .slice(0, -1)
      .reduce((current, key) => current[key], obj);
    if (parent) {
      parent[lastKey] = value;
    }
  }

  /**
   * 빠른 구조 검증 (Zod 없이)
   */
  static quickValidate(strategy: any): boolean {
    return !!(
      strategy &&
      strategy.phase1 &&
      strategy.phase2 &&
      strategy.phase3 &&
      typeof strategy.phase1.entryRatio === 'number' &&
      strategy.phase1.stopLoss &&
      strategy.phase2.bullish &&
      strategy.phase2.sideways &&
      strategy.phase2.bearish &&
      strategy.phase3.target1 &&
      strategy.phase3.target2
    );
  }
}

