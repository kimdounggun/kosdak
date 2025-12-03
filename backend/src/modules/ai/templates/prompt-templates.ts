/**
 * AI 프롬프트 템플릿
 * Phase 2-1: 토큰 최적화 (긴 프롬프트 → 짧고 효율적)
 */

import { StrategyGenerationContext } from '../types/strategy-types';

/**
 * 시스템 프롬프트 (역할 정의)
 */
export const SYSTEM_PROMPT = `당신은 전문 투자 전략가입니다. 기술지표를 분석해 구체적이고 실행 가능한 투자 전략을 JSON으로 생성합니다. 모든 비율과 근거를 명시하세요.`;

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

  // 간결한 지표 상태
  const rsiStatus = rsi > 70 ? '과매수' : rsi < 30 ? '과매도' : '중립';
  const macdStatus = macd > macdSignal ? '상승' : '하락';
  const trendStatus =
    currentPrice > ma20 && ma20 > ma60
      ? '정배열'
      : currentPrice < ma20 && ma20 < ma60
        ? '역배열'
        : '혼조';

  // 최적화된 프롬프트 (토큰 절감)
  return `[종목] ${symbol.name} ${currentPrice.toLocaleString()}원
[기간] ${periodMap[investmentPeriod]} (변동성: ${volatilityLevel})

[지표]
RSI: ${rsi.toFixed(1)} (${rsiStatus})
MACD: ${macd > macdSignal ? '상승돌파' : '하락돌파'}
추세: ${trendStatus}
거래량: 평균 대비 ${((volume / avgVolume) * 100).toFixed(0)}%

[목표]
진입: ${entryPrice.toLocaleString()}원
1차: ${targetPrice1.toLocaleString()}원 (+${(((targetPrice1 - entryPrice) / entryPrice) * 100).toFixed(1)}%)
2차: ${targetPrice2.toLocaleString()}원 (+${(((targetPrice2 - entryPrice) / entryPrice) * 100).toFixed(1)}%)
손절: ${stopLossPrice.toLocaleString()}원 (${(((stopLossPrice - entryPrice) / entryPrice) * 100).toFixed(1)}%)
${historicalContext ? `\n[과거] 성공률 ${historicalContext.successRate}%, 평균 ${historicalContext.avgReturn}%` : ''}

JSON 형식으로 투자 전략 생성:
{
  "phase1": {
    "entryRatio": 25~40,
    "entryTiming": "구체적 타이밍",
    "reasoning": "4가지 근거\\n1) 기술적: ...\\n2) 추세: ...\\n3) 지지저항: ...\\n4) 거래량: ...",
    "stopLoss": {"price": ${stopLossPrice}, "percent": ${(((stopLossPrice - entryPrice) / entryPrice) * 100).toFixed(1)}, "timing": "타이밍", "reason": "근거"}
  },
  "phase2": {
    "bullish": {"condition": "상승 조건", "action": "액션", "actionRatio": 20~40, "reason": "근거"},
    "sideways": {"condition": "횡보 조건", "action": "액션", "reason": "근거"},
    "bearish": {"condition": "하락 조건", "action": "액션", "exitRatio": 50~100, "reason": "근거"}
  },
  "phase3": {
    "target1": {"price": "${targetPrice1.toLocaleString()}원", "action": "액션", "exitRatio": 30~60, "reason": "근거"},
    "target2": {"price": "${targetPrice2.toLocaleString()}원", "action": "액션", "exitRatio": 30~100, "reason": "근거"}
  }
}

중요: JSON만 출력, 모든 비율 숫자로, 보수형/기본형/공격형 같은 불필요한 필드 추가 금지`;
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

