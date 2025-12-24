/**
 * 투자 전략 설정 (프론트엔드)
 * 백엔드 설정과 일치하도록 유지
 */

export interface TradingStrategyConfig {
  target1Percent: number;
  target2Percent: number;
  stopLossPercent: number;
}

export interface PeriodStrategyConfig {
  swing: TradingStrategyConfig;
  medium: TradingStrategyConfig;
  long: TradingStrategyConfig;
}

/**
 * 기본 투자 전략 설정
 * 백엔드와 동일한 값 사용
 */
export const TRADING_STRATEGY_CONFIG: PeriodStrategyConfig = {
  swing: {
    target1Percent: 3,
    target2Percent: 5,
    stopLossPercent: 3,
  },
  medium: {
    target1Percent: 10,
    target2Percent: 12,
    stopLossPercent: 5,
  },
  long: {
    target1Percent: 20,
    target2Percent: 30,
    stopLossPercent: 8,
  },
};

/**
 * Fallback 목표가 계산 (AI 파싱 실패 시)
 */
export function getFallbackTargets(
  investmentPeriod: 'swing' | 'medium' | 'long',
  entryPrice: number
): { target1: number; target2: number; stopLoss: number } {
  const config = TRADING_STRATEGY_CONFIG[investmentPeriod] || TRADING_STRATEGY_CONFIG.swing;
  
  return {
    target1: entryPrice * (1 + config.target1Percent / 100),
    target2: entryPrice * (1 + config.target2Percent / 100),
    stopLoss: entryPrice * (1 - config.stopLossPercent / 100),
  };
}














