/**
 * 리포트 유효기간 설정
 * 투자 기간과 시장 변동성에 따라 동적으로 조정
 */

export interface ValidityConfig {
  baseHours: {
    swing: number;
    medium: number;
    long: number;
  };
  volatilityAdjustment: {
    high: number;    // 변동성 높으면 절반으로
    medium: number;
    low: number;     // 변동성 낮으면 1.5배
  };
}

export const REPORT_VALIDITY_CONFIG: ValidityConfig = {
  baseHours: {
    swing: parseFloat(process.env.REPORT_VALID_SWING_HOURS || '12'),
    medium: parseFloat(process.env.REPORT_VALID_MEDIUM_HOURS || '24'),
    long: parseFloat(process.env.REPORT_VALID_LONG_HOURS || '72'),
  },
  volatilityAdjustment: {
    high: parseFloat(process.env.REPORT_VOL_ADJ_HIGH || '0.5'),
    medium: 1.0,
    low: parseFloat(process.env.REPORT_VOL_ADJ_LOW || '1.5'),
  },
};

/**
 * 리포트 유효기간 계산
 */
export function getReportValidity(
  investmentPeriod: 'swing' | 'medium' | 'long',
  volatilityLevel: 'high' | 'medium' | 'low' = 'medium'
): number {
  const baseHours = REPORT_VALIDITY_CONFIG.baseHours[investmentPeriod];
  const adjustment = REPORT_VALIDITY_CONFIG.volatilityAdjustment[volatilityLevel];
  
  return baseHours * adjustment;
}

/**
 * 리포트 만료 시간 계산
 */
export function getValidUntil(
  investmentPeriod: 'swing' | 'medium' | 'long',
  volatilityLevel: 'high' | 'medium' | 'low' = 'medium'
): Date {
  const hours = getReportValidity(investmentPeriod, volatilityLevel);
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

