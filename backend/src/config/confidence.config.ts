/**
 * AI 신뢰도 계산 설정
 * 환경변수 또는 DB에서 로드 가능하도록 설계
 */

export interface ConfidenceWeights {
  historicalAccuracy: number;
  dataQuality: {
    high: number;    // 캔들 100개 이상
    medium: number;  // 캔들 50개 이상
  };
  indicatorAgreement: number;
  volume: {
    surge: number;    // 거래량 1.5배 이상
    increase: number; // 거래량 1.0배 이상
  };
  volatility: {
    high: number;    // 변동성 높음 패널티
    medium: number;  // 변동성 중간 패널티
  };
  sampleSizeBonus: number; // 샘플 20개 이상 보너스
}

export interface ConfidenceThresholds {
  rsi: {
    overbought: number;
    oversold: number;
  };
  macd: {
    significant: number; // MACD-Signal 차이 임계값
  };
  volatility: {
    high: number;    // 0.15
    medium: number;  // 0.1
  };
  volume: {
    surge: number;    // 1.5
    increase: number; // 1.0
  };
  sampleSize: {
    bonus: number; // 20
  };
}

export interface ConfidenceBounds {
  min: number;
  max: number;
}

export interface MarketAdjustments {
  volatile: Partial<ConfidenceWeights>;
  stable: Partial<ConfidenceWeights>;
}

/**
 * 기본 신뢰도 계산 설정
 */
export const CONFIDENCE_CONFIG = {
  base: parseFloat(process.env.CONFIDENCE_BASE || '0.5'),
  
  weights: {
    historicalAccuracy: parseFloat(process.env.CONF_HISTORICAL_WEIGHT || '0.3'),
    dataQuality: {
      high: parseFloat(process.env.CONF_DATA_QUALITY_HIGH || '0.15'),
      medium: parseFloat(process.env.CONF_DATA_QUALITY_MEDIUM || '0.08'),
    },
    indicatorAgreement: parseFloat(process.env.CONF_INDICATOR_WEIGHT || '0.15'),
    volume: {
      surge: parseFloat(process.env.CONF_VOLUME_SURGE || '0.1'),
      increase: parseFloat(process.env.CONF_VOLUME_INCREASE || '0.05'),
    },
    volatility: {
      high: parseFloat(process.env.CONF_VOLATILITY_HIGH || '0.15'),
      medium: parseFloat(process.env.CONF_VOLATILITY_MEDIUM || '0.1'),
    },
    sampleSizeBonus: parseFloat(process.env.CONF_SAMPLE_BONUS || '0.05'),
  },
  
  thresholds: {
    rsi: {
      overbought: parseFloat(process.env.RSI_OVERBOUGHT || '70'),
      oversold: parseFloat(process.env.RSI_OVERSOLD || '30'),
    },
    macd: {
      significant: parseFloat(process.env.MACD_SIGNIFICANT || '50'),
    },
    volatility: {
      high: parseFloat(process.env.VOLATILITY_HIGH || '0.15'),
      medium: parseFloat(process.env.VOLATILITY_MEDIUM || '0.1'),
    },
    volume: {
      surge: parseFloat(process.env.VOLUME_SURGE || '1.5'),
      increase: parseFloat(process.env.VOLUME_INCREASE || '1.0'),
    },
    sampleSize: {
      bonus: parseFloat(process.env.SAMPLE_SIZE_BONUS || '20'),
    },
  },
  
  bounds: {
    min: parseFloat(process.env.CONFIDENCE_MIN || '0.35'),
    max: parseFloat(process.env.CONFIDENCE_MAX || '0.95'),
  },
  
  /**
   * 시장 상황별 조정 (불안정/안정 시장)
   */
  marketAdjustments: {
    volatile: {
      historicalAccuracy: parseFloat(process.env.CONF_VOLATILE_HISTORICAL || '0.2'),
      volatility: parseFloat(process.env.CONF_VOLATILE_VOLATILITY || '0.2'),
    },
    stable: {
      historicalAccuracy: parseFloat(process.env.CONF_STABLE_HISTORICAL || '0.4'),
      volatility: parseFloat(process.env.CONF_STABLE_VOLATILITY || '0.1'),
    },
  },
};

/**
 * 시장 상황 판단
 */
export function getMarketCondition(volatility: number, recentVolatility?: number): 'volatile' | 'stable' | 'normal' {
  // 변동성이 높으면 불안정
  if (volatility > 0.15) return 'volatile';
  
  // 최근 변동성이 급증하면 불안정
  if (recentVolatility && recentVolatility > volatility * 1.5) return 'volatile';
  
  // 변동성이 낮으면 안정
  if (volatility < 0.05) return 'stable';
  
  return 'normal';
}

/**
 * 시장 상황에 따른 가중치 조정
 */
export function getAdjustedWeights(marketCondition: 'volatile' | 'stable' | 'normal'): ConfidenceWeights {
  const baseWeights = CONFIDENCE_CONFIG.weights;
  
  if (marketCondition === 'volatile') {
    const adjustments = CONFIDENCE_CONFIG.marketAdjustments.volatile;
    return {
      ...baseWeights,
      historicalAccuracy: adjustments.historicalAccuracy ?? baseWeights.historicalAccuracy,
      volatility: {
        high: adjustments.volatility ?? baseWeights.volatility.high,
        medium: baseWeights.volatility.medium,
      },
    };
  }
  
  if (marketCondition === 'stable') {
    const adjustments = CONFIDENCE_CONFIG.marketAdjustments.stable;
    return {
      ...baseWeights,
      historicalAccuracy: adjustments.historicalAccuracy ?? baseWeights.historicalAccuracy,
      volatility: {
        high: baseWeights.volatility.high,
        medium: adjustments.volatility ?? baseWeights.volatility.medium,
      },
    };
  }
  
  return baseWeights;
}














