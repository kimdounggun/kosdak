import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiReport, AiReportDocument } from '../../schemas/ai-report.schema';
import { CandlesService } from '../candles/candles.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { SymbolsService } from '../symbols/symbols.service';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(
    @InjectModel(AiReport.name) private aiReportModel: Model<AiReportDocument>,
    private candlesService: CandlesService,
    private indicatorsService: IndicatorsService,
    private symbolsService: SymbolsService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async generateReport(
    symbolId: string,
    timeframe: string = '5m',
    reportType: string = 'comprehensive',
    userId?: string,
    investmentPeriod: string = 'swing',
  ): Promise<AiReportDocument> {
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

    // 🆕 과거 유사 패턴 분석 (백테스팅 데이터 활용)
    const historicalContext = await this.getHistoricalContext(symbolId, latestIndicator);

    const prompt = this.buildPrompt(symbol, candles, indicators, reportType, investmentPeriod, historicalContext);

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

    // Generate AI report
    if (this.openai) {
      try {
        // Step 1: 기술적 지표 분석
        analysisProcess.step1 = {
          status: 'completed',
          result: '기술적 지표 분석 완료',
          details: {
            rsi: latestIndicator?.rsi || 0,
            macd: latestIndicator?.macd || 0,
            ma5: latestIndicator?.ma5 || 0,
            ma20: latestIndicator?.ma20 || 0,
            ma60: latestIndicator?.ma60 || 0,
          }
        };

        // Step 2: 패턴 인식
        const recentTrend = this.analyzeTrend(candles);
        analysisProcess.step2 = {
          status: 'completed',
          result: '패턴 인식 완료',
          details: recentTrend
        };

        // Step 3: 리스크 평가
        const riskAssessment = this.assessRisk(candles, latestIndicator);
        analysisProcess.step3 = {
          status: 'completed',
          result: '리스크 평가 완료',
          details: riskAssessment
        };

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: '당신은 금융 트레이딩 분석 모델입니다. 수치 기반 사실만 작성하며, 모든 판단에는 구체적인 근거를 명시합니다. 확률 계산 시 반드시 계산 근거를 함께 제시합니다.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.5,
          max_tokens: 1500,
        });

        content = completion.choices[0].message.content || '';
        rawResponse = content;
        
        // 메타데이터 업데이트
        metadata.model = 'gpt-4o-mini';
        metadata.modelVersion = 'gpt-4o-mini-2024-07-18';
        metadata.tokensUsed = completion.usage?.total_tokens || 0;
        metadata.processingTimeMs = Date.now() - startTime;

        // 가중치 계산
        explainability.factors = this.calculateFactorWeights(latestIndicator, candles);
        explainability.reasoning = this.generateReasoning(latestIndicator, candles);
        explainability.alternatives = this.generateAlternatives(latestIndicator);
        
        // AI 응답 검증
        const validation = this.validateAIResponse(content);
        if (!validation.isValid) {
          console.warn('AI 응답 검증 실패:', validation.errors);
          console.warn('원본 응답:', content);
          // 검증 실패 시 fallback 사용
          content = this.generateFallbackReport(symbol, latestCandle, latestIndicator);
          metadata.validationFailed = true;
          metadata.validationErrors = validation.errors;
        } else {
          metadata.validationPassed = true;
        }
      } catch (error) {
        console.error('OpenAI API error:', error);
        content = this.generateFallbackReport(symbol, latestCandle, latestIndicator);
        analysisProcess.step1 = { status: 'error', result: 'API 오류', details: error.message };
      }
    } else {
      content = this.generateFallbackReport(symbol, latestCandle, latestIndicator);
      analysisProcess.step1 = { status: 'skipped', result: 'OpenAI API 키 없음', details: {} };
    }

    // AI 예측 액션 추출 (백테스팅용)
    let predictedAction = '관망';
    const actionMatch = content.match(/권장 포지션:\s*\[?([^\]]+)\]?/);
    if (actionMatch) {
      predictedAction = actionMatch[1].trim();
    }

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
      validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000), // Valid for 6 hours
    });

    return report.save();
  }

  private validateAIResponse(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 1. 필수 섹션 확인
    const requiredSections = [
      '1. 시장 포지션',
      '2. 핵심 매매 시그널',
      '3. 실전 투자 전략',
      '4. 정량적 전망 요약'
    ];
    
    requiredSections.forEach(section => {
      if (!content.includes(section)) {
        errors.push(`필수 섹션 누락: ${section}`);
      }
    });
    
    // 2. 상승 확률 형식 확인
    const probabilityPattern = /상승 확률:\s*(\d+)%/;
    const probabilityMatch = content.match(probabilityPattern);
    if (!probabilityMatch) {
      errors.push('상승 확률 형식 오류: "상승 확률: XX%" 패턴 누락');
    } else {
      const probability = parseInt(probabilityMatch[1]);
      if (probability < 0 || probability > 100) {
        errors.push(`상승 확률 범위 오류: ${probability}% (0~100 범위 필요)`);
      }
    }
    
    // 3. 근거 확인
    const reasonPattern = /\(근거:[^)]+\)/;
    if (!reasonPattern.test(content)) {
      errors.push('상승 확률 근거 누락: "(근거: ...)" 패턴 필요');
    }
    
    // 4. 리스크 레벨 확인
    const riskPattern = /리스크 레벨:\s*(낮음|중간|높음)/;
    if (!riskPattern.test(content)) {
      errors.push('리스크 레벨 누락: "낮음/중간/높음" 중 하나 필요');
    }
    
    // 5. 권장 포지션 확인
    const positionPattern = /권장 포지션:\s*(강력 매수|매수|관망|주의|매도)/;
    if (!positionPattern.test(content)) {
      errors.push('권장 포지션 누락: "강력 매수/매수/관망/주의/매도" 중 하나 필요');
    }
    
    // 6. 최소 길이 확인 (너무 짧으면 제대로 된 분석 아님)
    if (content.length < 200) {
      errors.push(`응답 길이 부족: ${content.length}자 (최소 200자 필요)`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private buildPrompt(symbol: any, candles: any[], indicators: any[], reportType: string, investmentPeriod: string = 'swing', historicalContext?: any): string {
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

    // 투자 기간별 설명
    const periodInfo = {
      swing: { name: '단기 스윙', duration: '3~7일', target: '+3~5%', stoploss: '-3%' },
      medium: { name: '중기', duration: '2~4주', target: '+10~12%', stoploss: '-5%' },
      long: { name: '장기', duration: '1~3개월', target: '+20~30%', stoploss: '-8%' }
    };
    const period = periodInfo[investmentPeriod] || periodInfo.swing;

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

📌 이평선 판단 기준:
- 가격 > MA20 & MA20 > MA60 → 상승 추세
- MA20 횡보 → 관망
- 가격 < MA20 < MA60 → 하락 추세

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

아래 형식으로 정확히 출력하세요:

1. 시장 포지션
현재 추세는 [상승/하락/횡보]이며, 강도는 [약함/중간/강함]. [지표 근거 포함해 1~2문장]

2. 핵심 매매 시그널
- RSI: [수치 및 판단]
- MACD: [수치, 방향 및 판단]
- 이동평균선: [MA20/MA60 관계 및 판단]

3. 실전 투자 전략 (${period.name} 기준)
권장 포지션: [강력 매수/매수/관망/주의/매도]
상승 확률: [X]% (근거: [RSI 구간 판단] + [MACD 방향] + [이평선 배열])
리스크 레벨: [낮음/중간/높음]

📍 ${period.name} 전략 (${period.duration}):
- 진입가: ${currentPrice.toLocaleString()}원 (현재가 기준)
- 손절가: [현재가 ${period.stoploss} 수준]원
- 1차 목표가: [현재가 +${period.target.split('~')[0]} 수준]원
- 2차 목표가: [현재가 +${period.target.split('~')[1]} 수준]원
- 권장 전략: ${investmentPeriod === 'swing' ? period.duration + ' 기간 내 1일차 분할 진입' : investmentPeriod === 'medium' ? '이번 주 첫 진입 후 2주차 추가' : '1개월간 3~4회 분할 매수'}

예시) 상승 확률: 70% (근거: RSI 상승 구간 + MACD 상향돌파 + MA 정배열)

4. 정량적 전망 요약
[한 문장 결론 + 주의 문장 포함]

※ 본 분석은 20분 지연 시세 데이터 기반으로 제공되며 투자 판단 책임은 사용자에게 있습니다.
`;

    return prompt;
  }

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

  async getLatestReport(symbolId: string, timeframe: string = '5m', userId?: string) {
    const query: any = {
      symbolId: new Types.ObjectId(symbolId),
      timeframe,
      // validUntil 체크 제거 - 항상 최신 리포트 반환 ✅
    };

    if (userId) {
      query.userId = new Types.ObjectId(userId);
    }

    return this.aiReportModel.findOne(query).sort({ createdAt: -1 });
  }

  async getUserReports(userId: string, limit: number = 20) {
    return this.aiReportModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('symbolId')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async getSymbolHistory(symbolId: string, userId: string, limit: number = 10) {
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
      correct: report.actualOutcome?.wasCorrect || null,
      confidence: report.metadata?.confidence ? Math.round(report.metadata.confidence * 100) : null,
      reportId: report._id,
    }));
  }

  async getBacktestingStats(symbolId: string, userId: string) {
    const reports = await this.aiReportModel
      .find({ 
        symbolId: new Types.ObjectId(symbolId),
        userId: new Types.ObjectId(userId),
        'actualOutcome.wasCorrect': { $exists: true }
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
    const correctPredictions = reports.filter(r => r.actualOutcome?.wasCorrect).length;
    const accuracy = (correctPredictions / totalPredictions * 100).toFixed(0);

    const buyReports = reports.filter(r => r.predictedAction?.includes('매수'));
    const buyCorrect = buyReports.filter(r => r.actualOutcome?.wasCorrect).length;
    const buyAccuracy = buyReports.length > 0 ? (buyCorrect / buyReports.length * 100).toFixed(0) : 0;

    const sellReports = reports.filter(r => r.predictedAction?.includes('매도') || r.predictedAction?.includes('주의'));
    const sellCorrect = sellReports.filter(r => r.actualOutcome?.wasCorrect).length;
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
    const correct = filtered.filter(r => r.actualOutcome?.wasCorrect).length;
    return {
      count: filtered.length,
      accuracy: filtered.length > 0 ? parseFloat((correct / filtered.length * 100).toFixed(0)) : 0,
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
      const successCases = filteredReports.filter(r => r.actualOutcome?.wasCorrect).length;
      const successRate = Math.round((successCases / totalCases) * 100);

      const returns = filteredReports
        .map(r => r.actualOutcome?.priceChangePercent || 0)
        .filter(r => r !== 0);

      const avgReturn = returns.length > 0 
        ? parseFloat((returns.reduce((sum, r) => sum + r, 0) / returns.length).toFixed(2))
        : 0;

      const maxReturn = returns.length > 0 ? parseFloat(Math.max(...returns).toFixed(2)) : 0;
      const minReturn = returns.length > 0 ? parseFloat(Math.min(...returns).toFixed(2)) : 0;

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
        insight
      };
    } catch (error) {
      console.error('Historical context error:', error);
      return null;
    }
  }
}



