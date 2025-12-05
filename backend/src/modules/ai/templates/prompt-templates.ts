/**
 * AI 프롬프트 템플릿
 * Phase 2-1: 토큰 최적화 (긴 프롬프트 → 짧고 효율적)
 */

import { StrategyGenerationContext } from '../types/strategy-types';

/**
 * 시스템 프롬프트 (역할 정의)
 */
export const SYSTEM_PROMPT = `당신은 10년 경력의 전문 퀀트 트레이더입니다. 
기술적 분석 지표(RSI, MACD, 이동평균선 등)의 구체적 수치와 해석을 명확히 제시하고, 
각 매수/매도 시점에 대한 정량적 기준과 비율을 제시하며,
목표가 설정 근거(피보나치, 저항대, 볼린저밴드 등)를 명시하는 실전 투자 전략을 JSON으로 생성합니다.`;

/**
 * 전략 생성 프롬프트 (최적화 버전)
 */
export function buildStrategyPrompt(context: StrategyGenerationContext): string {
  const {
    symbol,
    entryPrice,
    targetPrice1,
    targetPrice2,
    stopLossPrice,
    latestCandle,
    latestIndicator,
    candles,
    investmentPeriod,
    volatilityLevel,
    historicalContext,
  } = context;

  const currentPrice = latestCandle.close;
  const rsi = latestIndicator?.rsi || 50;
  const macd = latestIndicator?.macd || 0;
  const macdSignal = latestIndicator?.macdSignal || 0;
  const ma20 = latestIndicator?.ma20 || currentPrice;
  const ma60 = latestIndicator?.ma60 || currentPrice;
  const volume = latestCandle.volume || 0;
  const avgVolume =
    candles.slice(0, 20).reduce((sum, c) => sum + (c.volume || 0), 0) /
    Math.min(20, candles.length);

  // 투자 기간 매핑
  const periodMap = {
    swing: '3~7일',
    medium: '2~4주',
    long: '1~3개월',
  };

  // 구체적인 지표 상태 분석
  const rsiStatus = 
    rsi > 70 ? '과매수(매도 압력 예상)' : 
    rsi > 60 ? '강세(매수 우위)' :
    rsi > 50 ? '중립 상향(매수세 우위)' :
    rsi > 40 ? '중립 하향(매도세 우위)' :
    rsi > 30 ? '약세(매도 압력)' : 
    '과매도(반등 가능)';
  
  const macdDiff = macd - macdSignal;
  const macdStatus = 
    macd > 0 && macdDiff > 0 ? '골든크로스(0선 위 상향돌파, 강한 매수신호)' :
    macd > 0 && macdDiff < 0 ? '0선 위 데드크로스(매도 주의)' :
    macd < 0 && macdDiff > 0 ? '0선 아래 골든크로스(반등 시도)' :
    '0선 아래 데드크로스(약세 지속)';
  
  const ma5 = latestIndicator?.ma5 || currentPrice;
  const trendStatus =
    currentPrice > ma5 && ma5 > ma20 && ma20 > ma60
      ? '정배열(5-20-60일선, 강한 상승추세)'
      : currentPrice < ma5 && ma5 < ma20 && ma20 < ma60
        ? '역배열(5-20-60일선, 강한 하락추세)'
        : currentPrice > ma20 && ma20 > ma60
          ? '부분 정배열(20-60일선, 중기 상승)'
          : '혼조(방향성 불명확)';

  // 과거 가격 분석 (지지/저항 레벨)
  const recentHigh = Math.max(...candles.slice(0, 20).map(c => c.high));
  const recentLow = Math.min(...candles.slice(0, 20).map(c => c.low));
  const priceRange = recentHigh - recentLow;
  
  // 피보나치 레벨 계산 (간략)
  const fib236 = recentLow + priceRange * 0.236;
  const fib382 = recentLow + priceRange * 0.382;
  const fib618 = recentLow + priceRange * 0.618;

  // 개선된 프롬프트 (구체성 강화)
  return `[종목] ${symbol.name} 
현재가: ${currentPrice.toLocaleString()}원
투자기간: ${periodMap[investmentPeriod]} (변동성: ${volatilityLevel})

[기술적 지표 분석]
1. RSI: ${rsi.toFixed(1)} - ${rsiStatus}
   → 해석: ${rsi > 50 ? `50선 위 ${(rsi - 50).toFixed(1)}p로 매수세 우위` : `50선 아래 ${(50 - rsi).toFixed(1)}p로 매도세 우위`}

2. MACD: ${macd.toFixed(2)} / Signal: ${macdSignal.toFixed(2)} (차이: ${macdDiff.toFixed(2)})
   → 상태: ${macdStatus}
   → 최근 ${Math.abs(macdDiff) < 0.5 ? '신호선 근접' : macdDiff > 0 ? '상승 모멘텀 강화' : '하락 모멘텀 강화'}

3. 이동평균: ${trendStatus}
   - MA5: ${ma5.toFixed(0)}원 (현재가 ${currentPrice > ma5 ? '+' : ''}${(((currentPrice - ma5) / ma5) * 100).toFixed(1)}%)
   - MA20: ${ma20.toFixed(0)}원 (현재가 ${currentPrice > ma20 ? '+' : ''}${(((currentPrice - ma20) / ma20) * 100).toFixed(1)}%)
   - MA60: ${ma60.toFixed(0)}원 (현재가 ${currentPrice > ma60 ? '+' : ''}${(((currentPrice - ma60) / ma60) * 100).toFixed(1)}%)

4. 거래량: ${volume.toLocaleString()} (평균 대비 ${((volume / avgVolume) * 100).toFixed(0)}%)
   → ${volume > avgVolume * 1.2 ? '거래량 급증(관심 증가)' : volume < avgVolume * 0.8 ? '거래량 감소(관심 저하)' : '평균 수준'}

[가격 레벨 분석]
- 20일 최고가: ${recentHigh.toLocaleString()}원 (저항)
- 20일 최저가: ${recentLow.toLocaleString()}원 (지지)
- 피보나치 23.6%: ${fib236.toFixed(0)}원
- 피보나치 38.2%: ${fib382.toFixed(0)}원
- 피보나치 61.8%: ${fib618.toFixed(0)}원

[목표가 설정]
진입가: ${entryPrice.toLocaleString()}원
1차 목표: ${targetPrice1.toLocaleString()}원 (+${(((targetPrice1 - entryPrice) / entryPrice) * 100).toFixed(1)}%) - 근거 필수 명시
2차 목표: ${targetPrice2.toLocaleString()}원 (+${(((targetPrice2 - entryPrice) / entryPrice) * 100).toFixed(1)}%) - 근거 필수 명시
손절가: ${stopLossPrice.toLocaleString()}원 (${(((stopLossPrice - entryPrice) / entryPrice) * 100).toFixed(1)}%)
${historicalContext ? `\n[백테스트 데이터] 성공률 ${historicalContext.successRate}%, 평균 수익률 ${historicalContext.avgReturn}%` : ''}

[전략 수립 시 필수 고려사항]
⚠️ 기술적 분석만으로는 불충분합니다. 아래 사항들을 반드시 고려하여 전략을 수립하세요:
1. 단기 이벤트: ${periodMap[investmentPeriod]} 기간 내 실적발표, 정책발표, 업종 이슈 등이 있을 경우 변동성 증가 예상
2. 업종 흐름: 해당 종목이 속한 업종의 단기 모멘텀이 개별 종목에 영향
3. 시장 심리: FOMC, 금리 발표 등 거시 이벤트가 기간 내 포함되면 리스크 확대 가능
→ reasoning 필드에 "단, 단기 이슈/업종 리스크 확인 필요" 등의 주의사항 포함 권장

===========================================
아래 형식으로 JSON 전략 생성:
===========================================

{
  "phase1": {
    "entryRatio": 25~40 (숫자),
    "entryTiming": "구체적 진입 타이밍 (예: RSI 55 유지 시, MACD 골든크로스 후 2캔들 확인, MA20 지지 확인 시 등)",
    "reasoning": "반드시 4가지 명확한 근거 제시:\\n1) 기술적 지표: RSI/MACD 수치와 의미\\n2) 추세 분석: 이동평균선 배열과 방향성\\n3) 지지/저항: 현재가 위치와 돌파/지지 가능성\\n4) 거래량: 거래량 변화와 시장 관심도",
    "stopLoss": {
      "price": ${stopLossPrice},
      "percent": ${(((stopLossPrice - entryPrice) / entryPrice) * 100).toFixed(1)},
      "timing": "손절 조건 (예: MA20 하향 이탈 시, RSI 30 하회 시 등)",
      "reason": "손절가 설정 근거 (예: 피보나치 38.2% 지지선, 20일 최저가 하단 등)"
    }
  },
  "phase2": {
    "bullish": {
      "condition": "상승 시나리오 구체적 조건 (예: MACD 히스토그램 3캔들 연속 증가, 거래량 평균 대비 120% 이상 유지)",
      "action": "추가 매수",
      "actionRatio": 20~40 (숫자, 1차 진입 대비 추가 비율),
      "reason": "추가 매수 근거 (예: 상승 추세 강화 확인, MA5 지지 유지 등)"
    },
    "sideways": {
      "condition": "횡보 시나리오 구체적 조건 (예: 현재가 ±2% 범위 3일 이상 유지, RSI 40~60 구간)",
      "action": "홀딩 또는 부분 익절 후 재진입 대기",
      "reason": "횡보 대응 근거 (예: 박스권 상단 돌파 대기, 거래량 증가 시그널 확인 등)"
    },
    "bearish": {
      "condition": "하락 시나리오 구체적 조건 (예: MA20 하향 이탈, MACD 데드크로스, RSI 40 하회)",
      "action": "부분 매도 또는 전량 청산",
      "exitRatio": 50~100 (숫자, 50=절반 매도, 100=전량 청산),
      "reason": "하락 대응 근거 (예: 추세 전환 확인, 손실 확대 방지 등)"
    }
  },
  "phase3": {
    "target1": {
      "price": "${targetPrice1.toLocaleString()}원",
      "action": "50% 부분 익절 + 트레일링 스탑 설정",
      "exitRatio": 40~60 (숫자),
      "reason": "1차 목표가 설정 근거 필수 (예: 피보나치 61.8% 레벨, 20일 최고가 돌파 지점, 볼린저밴드 상단 등)"
    },
    "target2": {
      "price": "${targetPrice2.toLocaleString()}원",
      "action": "나머지 물량 익절 또는 트레일링 스탑으로 최대 수익 추구",
      "exitRatio": 40~100 (숫자),
      "reason": "2차 목표가 설정 근거 필수 (예: 피보나치 확장 161.8%, 과거 고점 저항대, 심리적 가격대 등)"
    }
  }
}

===========================================
중요 규칙:
1. 모든 비율은 숫자로만 (문자열 금지)
2. 모든 "reason" 필드는 구체적 근거 명시 (최소 10자 이상)
3. 목표가 설정 시 피보나치/저항대/이동평균 등 기술적 근거 반드시 포함
4. MACD/RSI 언급 시 구체적 수치와 해석 포함
5. 추가 매수/매도 조건은 정량적 기준 제시 (예: "RSI 60 이상", "거래량 120% 이상")
6. JSON만 출력, 다른 설명 금지
===========================================`;
}

/**
 * 토큰 사용량 추정
 */
export function estimateTokens(prompt: string): number {
  // 대략적인 추정: 영문 1단어 ≈ 1토큰, 한글 1글자 ≈ 1.5토큰
  const koreanChars = (prompt.match(/[가-힣]/g) || []).length;
  const englishWords = (prompt.match(/[a-zA-Z]+/g) || []).length;
  const numbers = (prompt.match(/\d+/g) || []).length;

  return Math.ceil(koreanChars * 1.5 + englishWords + numbers * 0.5);
}

/**
 * 프롬프트 요약 정보
 */
export function getPromptSummary(prompt: string): {
  length: number;
  estimatedTokens: number;
  lines: number;
} {
  return {
    length: prompt.length,
    estimatedTokens: estimateTokens(prompt),
    lines: prompt.split('\n').length,
  };
}

