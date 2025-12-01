/**
 * 투자 전략 설정
 * 환경변수 또는 DB에서 로드 가능하도록 설계
 */

export interface TradingStrategyConfig {
  target1Percent: number;
  target2Percent: number;
  stopLossPercent: number;
  volatilityMultiplier: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface PeriodStrategyConfig {
  swing: TradingStrategyConfig;
  medium: TradingStrategyConfig;
  long: TradingStrategyConfig;
}

/**
 * 기본 투자 전략 설정
 * 환경변수로 오버라이드 가능
 */
export const TRADING_STRATEGY_CONFIG: PeriodStrategyConfig = {
  swing: {
    target1Percent: parseFloat(process.env.SWING_TARGET_1 || '3'),
    target2Percent: parseFloat(process.env.SWING_TARGET_2 || '5'),
    stopLossPercent: parseFloat(process.env.SWING_STOP_LOSS || '3'),
    volatilityMultiplier: {
      high: parseFloat(process.env.SWING_VOL_MULT_HIGH || '1.5'),
      medium: 1.0,
      low: parseFloat(process.env.SWING_VOL_MULT_LOW || '0.7'),
    },
  },
  medium: {
    target1Percent: parseFloat(process.env.MEDIUM_TARGET_1 || '10'),
    target2Percent: parseFloat(process.env.MEDIUM_TARGET_2 || '12'),
    stopLossPercent: parseFloat(process.env.MEDIUM_STOP_LOSS || '5'),
    volatilityMultiplier: {
      high: parseFloat(process.env.MEDIUM_VOL_MULT_HIGH || '1.3'),
      medium: 1.0,
      low: parseFloat(process.env.MEDIUM_VOL_MULT_LOW || '0.8'),
    },
  },
  long: {
    target1Percent: parseFloat(process.env.LONG_TARGET_1 || '20'),
    target2Percent: parseFloat(process.env.LONG_TARGET_2 || '30'),
    stopLossPercent: parseFloat(process.env.LONG_STOP_LOSS || '8'),
    volatilityMultiplier: {
      high: parseFloat(process.env.LONG_VOL_MULT_HIGH || '1.2'),
      medium: 1.0,
      low: parseFloat(process.env.LONG_VOL_MULT_LOW || '0.9'),
    },
  },
};

/**
 * 종목별 커스텀 설정 (고변동성/저변동성 종목)
 * 실제 운영 시 DB에서 관리 권장
 */
export const SYMBOL_OVERRIDES: Record<string, {
  swing?: Partial<TradingStrategyConfig>;
  medium?: Partial<TradingStrategyConfig>;
  long?: Partial<TradingStrategyConfig>;
}> = {
  // 고변동성 종목 (바이오, 게임주)
  '298380': { // 에이비엘바이오
    swing: { target1Percent: 5, target2Percent: 8 },
  },
  '112040': { // 위메이드
    swing: { target1Percent: 5, target2Percent: 8 },
  },
  '263750': { // 펄어비스
    swing: { target1Percent: 5, target2Percent: 8 },
  },
  
  // 저변동성 종목 (은행, 유틸리티)
  '105560': { // KB금융
    swing: { target1Percent: 2, target2Percent: 4 },
    medium: { target1Percent: 8, target2Percent: 10 },
  },
};

/**
 * 변동성 레벨 판단
 */
export function getVolatilityLevel(bbWidth: number | null): 'high' | 'medium' | 'low' {
  if (!bbWidth) return 'medium';
  
  if (bbWidth > 0.15) return 'high';
  if (bbWidth > 0.1) return 'medium';
  return 'low';
}

/**
 * 변동성 조정된 목표가 계산
 */
export function getAdjustedTargets(
  investmentPeriod: 'swing' | 'medium' | 'long',
  entryPrice: number,
  volatilityLevel: 'high' | 'medium' | 'low' = 'medium',
  symbolCode?: string
): { target1: number; target2: number; stopLoss: number } {
  // 기본 설정 가져오기
  const baseConfig = TRADING_STRATEGY_CONFIG[investmentPeriod];
  
  // 종목별 오버라이드 확인 및 병합
  const symbolOverride = symbolCode ? SYMBOL_OVERRIDES[symbolCode]?.[investmentPeriod] : undefined;
  const periodConfig: TradingStrategyConfig = symbolOverride
    ? {
        ...baseConfig,
        ...symbolOverride,
        // volatilityMultiplier는 오버라이드가 없으면 기본값 사용
        volatilityMultiplier: symbolOverride.volatilityMultiplier || baseConfig.volatilityMultiplier,
      }
    : baseConfig;
  
  // 변동성 조정
  const volMultiplier = periodConfig.volatilityMultiplier[volatilityLevel];
  
  const target1Percent = periodConfig.target1Percent * volMultiplier;
  const target2Percent = periodConfig.target2Percent * volMultiplier;
  const stopLossPercent = periodConfig.stopLossPercent; // 손절가는 변동성 조정 안 함
  
  return {
    target1: entryPrice * (1 + target1Percent / 100),
    target2: entryPrice * (1 + target2Percent / 100),
    stopLoss: entryPrice * (1 - Math.abs(stopLossPercent) / 100),
  };
}

/**
 * Fallback 목표가 (AI 파싱 실패 시)
 */
export function getFallbackTargets(
  investmentPeriod: 'swing' | 'medium' | 'long',
  entryPrice: number,
  volatilityLevel: 'high' | 'medium' | 'low' = 'medium',
  symbolCode?: string
): { target1: number; target2: number; stopLoss: number } {
  return getAdjustedTargets(investmentPeriod, entryPrice, volatilityLevel, symbolCode);
}

