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

  /**
   * 투자 기간에 따라 최적의 timeframe을 반환
   */
  private getOptimalTimeframe(investmentPeriod: string): string {
    const timeframeMap: Record<string, string> = {
      'swing': '1d',   // 3~7일 단기 스윙 → 일봉
      'medium': '1d',  // 2~4주 중기 → 일봉
      'long': '1w',    // 1~3개월 장기 → 주봉
    };
    
    return timeframeMap[investmentPeriod] || '1d'; // 기본값은 일봉
  }

  async generateReport(
    symbolId: string,
    timeframe?: string,
    reportType: string = 'comprehensive',
    userId?: string,
    investmentPeriod: string = 'swing',
  ): Promise<AiReportDocument> {
    // 🆕 투자 기간에 따라 적절한 timeframe 자동 선택
    if (!timeframe) {
      timeframe = this.getOptimalTimeframe(investmentPeriod);
    }

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

        // 🆕 AI 신뢰도 계산 (대형 플랫폼 방식: 백테스팅 기반)
        let confidenceScore = 0.5; // 기본 50%
        
        // ⭐ 1. 과거 예측 정확도 (최대 +30%, 가장 중요!)
        // Bloomberg/TradingView 방식: 실제 성과 기반
        if (historicalContext && historicalContext.totalCases >= 5) {
          const historicalAccuracy = historicalContext.successRate / 100;
          confidenceScore += historicalAccuracy * 0.3; // 성공률 70% → +21%
          
          // 샘플 수가 많을수록 신뢰도 증가
          if (historicalContext.totalCases >= 20) {
            confidenceScore += 0.05; // 충분한 샘플
          }
        }
        
        // 2. 데이터 품질 (최대 +15%)
        if (candles.length >= 100) {
          confidenceScore += 0.15;
        } else if (candles.length >= 50) {
          confidenceScore += 0.08;
        }
        
        // 3. 지표 일치도 (최대 +15%)
        // Google Gemini 방식: 여러 신호의 합의
        if (latestIndicator) {
          let agreementCount = 0;
          let totalSignals = 0;
          
          // RSI 신호
          if (latestIndicator.rsi) {
            totalSignals++;
            if (latestIndicator.rsi > 70 || latestIndicator.rsi < 30) {
              agreementCount++; // 명확한 신호
            }
          }
          
          // MACD 신호
          if (latestIndicator.macd !== undefined && latestIndicator.macdSignal !== undefined) {
            totalSignals++;
            if (Math.abs(latestIndicator.macd - latestIndicator.macdSignal) > 50) {
              agreementCount++; // 명확한 크로스오버
            }
          }
          
          // 이평선 배열
          if (latestIndicator.ma5 && latestIndicator.ma20 && latestIndicator.ma60) {
            totalSignals++;
            const isAligned = (latestIndicator.ma5 > latestIndicator.ma20 && latestIndicator.ma20 > latestIndicator.ma60) ||
                             (latestIndicator.ma5 < latestIndicator.ma20 && latestIndicator.ma20 < latestIndicator.ma60);
            if (isAligned) {
              agreementCount++; // 정배열 또는 역배열
            }
          }
          
          if (totalSignals > 0) {
            confidenceScore += (agreementCount / totalSignals) * 0.15;
          }
        }
        
        // 4. 시장 상황 적합성 (최대 +10%)
        // 거래량 확인 (TradingView 방식)
        if (latestIndicator?.volumeRatio) {
          if (latestIndicator.volumeRatio > 1.5) {
            confidenceScore += 0.1; // 거래량 급증 (신뢰도 높음)
          } else if (latestIndicator.volumeRatio > 1.0) {
            confidenceScore += 0.05; // 거래량 증가
          }
        }
        
        // 5. 변동성 패널티 (최대 -15%)
        // 변동성 높으면 예측 어려움
        if (latestIndicator?.bbUpper && latestIndicator?.bbLower && latestCandle) {
          const bbWidth = (latestIndicator.bbUpper - latestIndicator.bbLower) / latestCandle.close;
          if (bbWidth > 0.15) {
            confidenceScore -= 0.15; // 매우 높은 변동성
          } else if (bbWidth > 0.1) {
            confidenceScore -= 0.1; // 높은 변동성
          }
        }
        
        // 최종 신뢰도 (35~95% 범위)
        metadata.confidence = Math.min(0.95, Math.max(0.35, confidenceScore));

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

    // 🆕 목표가 파싱 (동적으로 AI가 제시한 목표가 추출)
    const entryPrice = latestCandle.close;
    const target1Match = content.match(/1차 목표가:.*?([\d,]+)원/);
    const target2Match = content.match(/2차 목표가:.*?([\d,]+)원/);
    
    let targetPrice1 = entryPrice * 1.05; // 기본값 +5%
    let targetPrice2 = entryPrice * 1.08; // 기본값 +8%
    
    if (target1Match) {
      targetPrice1 = parseInt(target1Match[1].replace(/,/g, ''));
    }
    if (target2Match) {
      targetPrice2 = parseInt(target2Match[1].replace(/,/g, ''));
    }
    
    // 목표 수익률 계산
    const targetPercent1 = parseFloat(((targetPrice1 - entryPrice) / entryPrice * 100).toFixed(2));
    const targetPercent2 = parseFloat(((targetPrice2 - entryPrice) / entryPrice * 100).toFixed(2));
    
    // metadata에 목표가 정보 추가
    metadata.targetPrice1 = targetPrice1;
    metadata.targetPrice2 = targetPrice2;
    metadata.targetPercent1 = targetPercent1;
    metadata.targetPercent2 = targetPercent2;

    // 🆕 투자 전략 파싱
    try {
      const strategy = this.parseInvestmentStrategy(content, entryPrice);
      if (strategy) {
        metadata.strategy = strategy;
      }
    } catch (error) {
      console.warn('전략 파싱 실패:', error.message);
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
    
    // 1. 필수 섹션 확인 (5개 섹션: 전략 섹션 포함)
    // 이모지가 포함될 수 있으므로 정규식으로 검증
    const requiredSections = [
      { pattern: /1\.\s+시장\s*포지션/, name: '1. 시장 포지션' },
      { pattern: /2\.\s+핵심\s*매매\s*시그널/, name: '2. 핵심 매매 시그널' },
      { pattern: /3\.\s+리스크\s*요인/, name: '3. 리스크 요인' },
      { pattern: /4\.\s+정량적\s*전망\s*요약/, name: '4. 정량적 전망 요약' },
      { pattern: /5\.\s+.*맞춤\s*투자\s*전략/, name: '5. 맞춤 투자 전략' }
    ];
    
    requiredSections.forEach(({ pattern, name }) => {
      if (!pattern.test(content)) {
        errors.push(`필수 섹션 누락: ${name}`);
      }
    });
    
    // 2. 최소 길이 확인 (너무 짧으면 제대로 된 분석 아님)
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
      swing: { 
        name: '단기 스윙', 
        duration: '3~7일', 
        target: '+3~5%', 
        stoploss: '-3%',
        target1Percent: 3,
        target2Percent: 5
      },
      medium: { 
        name: '중기', 
        duration: '2~4주', 
        target: '+10~12%', 
        stoploss: '-5%',
        target1Percent: 10,
        target2Percent: 12
      },
      long: { 
        name: '장기', 
        duration: '1~3개월', 
        target: '+20~30%', 
        stoploss: '-8%',
        target1Percent: 20,
        target2Percent: 30
      }
    };
    const period = periodInfo[investmentPeriod] || periodInfo.swing;
    
    // 기간별 목표가 계산
    const targetPrice1 = currentPrice * (1 + period.target1Percent / 100);
    const targetPrice2 = currentPrice * (1 + period.target2Percent / 100);
    const stopLossPrice = currentPrice * (1 + parseFloat(period.stoploss.replace('%', '')) / 100);

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

📌 추세 판단 기준 (최우선):
현재 상황:
- 현재가: ${currentPrice.toLocaleString()}원
- MA20: ${ma20.toFixed(0)}원
- MA60: ${ma60.toFixed(0)}원
- MACD: ${latestIndicator.macd ? latestIndicator.macd.toFixed(2) : 'N/A'}
- Signal: ${latestIndicator.macdSignal ? latestIndicator.macdSignal.toFixed(2) : 'N/A'}

⚠️ 추세 판단 규칙 (반드시 준수):
1. 현재가(${currentPrice}) > MA20(${ma20.toFixed(0)}) AND MA20 > MA60 → "상승 추세"
2. 현재가(${currentPrice}) < MA20(${ma20.toFixed(0)}) AND MA20 < MA60 → "하락 추세"
3. 그 외 → "횡보"

현재 실제 판단:
- 현재가 ${currentPrice > ma20 ? '>' : '<'} MA20: ${currentPrice > ma20 ? '상승 신호' : '하락 신호'}
- MA20 ${ma20 > ma60 ? '>' : '<'} MA60: ${ma20 > ma60 ? '정배열' : '역배열'}
→ 따라서 추세는 "${currentPrice > ma20 && ma20 > ma60 ? '상승' : currentPrice < ma20 && ma20 < ma60 ? '하락' : '횡보'}"입니다.

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

아래 형식으로 정확히 출력하세요. 리포트는 전문적이고 상세한 분석 중심으로 작성하세요.

1. 시장 포지션
위에서 계산한 추세를 그대로 사용하세요.
현재 추세는 [위에서 계산한 추세: 상승/하락/횡보]이며, 강도는 [약함/중간/강함]입니다. 
이 추세 판단은 최근 10일간의 가격 움직임을 분석한 결과로, 상승 캔들과 하락 캔들의 비율, 
가격 변동 폭, 거래량 변화 등을 종합적으로 고려한 것입니다.

현재가는 MA20(${ma20.toFixed(0)}원)을 ${currentPrice > ma20 ? '상회' : '하회'}하고 있으며, 
MACD는 Signal(${latestIndicator.macdSignal ? latestIndicator.macdSignal.toFixed(2) : 'N/A'})을 
${latestIndicator.macd && latestIndicator.macdSignal && latestIndicator.macd > latestIndicator.macdSignal ? '상향돌파' : '하향돌파'}한 상태입니다. 
이러한 기술적 지표의 조합은 시장의 현재 상태와 향후 방향성을 판단하는 중요한 근거가 됩니다.

과거 유사한 패턴을 분석한 결과, 이러한 조건에서 평균적으로 [추세에 따른 예상 기간 및 수익률]을 
보였던 사례가 많았습니다. 특히 [과거 데이터 기반 인사이트]를 참고할 필요가 있습니다.

2. 핵심 매매 시그널
각 기술적 지표를 상세히 분석하고 해석하세요.

- RSI: ${latestIndicator.rsi ? latestIndicator.rsi.toFixed(2) : 'N/A'} (${rsiStatus})
  현재 RSI 값은 ${latestIndicator.rsi ? (latestIndicator.rsi > 70 ? '과매수 구간(70 이상)' : latestIndicator.rsi < 30 ? '과매도 구간(30 이하)' : '중립 구간(30~70)') : 'N/A'}에 위치하고 있습니다. 
  이는 단기적으로 ${latestIndicator.rsi ? (latestIndicator.rsi > 70 ? '조정 압력이 높을 수 있음' : latestIndicator.rsi < 30 ? '반등 가능성이 있음' : '가격 변동성이 낮을 수 있음') : 'N/A'}을 의미합니다. 
  과거 데이터상 RSI가 이 구간에 있을 때 평균적으로 [예상 움직임]을 보였습니다.

- MACD: ${latestIndicator.macd ? latestIndicator.macd.toFixed(2) : 'N/A'}, Signal: ${latestIndicator.macdSignal ? latestIndicator.macdSignal.toFixed(2) : 'N/A'} 
  (${macdSignal === '매수' ? '상향돌파, 매수 신호' : macdSignal === '매도' ? '하향돌파, 매도 신호' : 'N/A'})
  MACD가 Signal을 ${latestIndicator.macd && latestIndicator.macdSignal && latestIndicator.macd > latestIndicator.macdSignal ? '상향돌파' : '하향돌파'}한 것은 
  단기 모멘텀이 ${latestIndicator.macd && latestIndicator.macdSignal && latestIndicator.macd > latestIndicator.macdSignal ? '강화' : '약화'}되고 있음을 나타냅니다. 
  이는 과거 데이터에서 ${latestIndicator.macd && latestIndicator.macdSignal && latestIndicator.macd > latestIndicator.macdSignal ? '상승 전환' : '하락 전환'}의 선행 지표로 작용한 경향이 있습니다. 
  Histogram 값(${(latestIndicator.macd && latestIndicator.macdSignal ? (latestIndicator.macd - latestIndicator.macdSignal).toFixed(2) : 'N/A')})은 
  모멘텀의 강도를 나타내며, ${latestIndicator.macd && latestIndicator.macdSignal && (latestIndicator.macd - latestIndicator.macdSignal) > 0 ? '증가 추세' : '감소 추세'}를 보이고 있습니다.

- 이동평균선: MA20(${ma20.toFixed(0)}원) ${ma20 > ma60 ? '>' : '<'} MA60(${ma60.toFixed(0)}원) 
  (${maAlignment})
  단기 이동평균선과 장기 이동평균선의 관계는 중장기 추세를 판단하는 중요한 지표입니다. 
  현재 ${maAlignment} 상태는 ${ma5 > ma20 && ma20 > ma60 ? '상승 추세가 지속될 가능성' : ma5 < ma20 && ma20 < ma60 ? '하락 추세가 지속될 가능성' : '추세의 불명확성'}을 시사합니다. 
  과거 유사한 패턴에서 평균적으로 [예상 기간 및 움직임]을 보였던 사례와 일치합니다. 
  현재가(${currentPrice.toLocaleString()}원)는 MA20 대비 ${((currentPrice - ma20) / ma20 * 100).toFixed(2)}% ${currentPrice > ma20 ? '높은' : '낮은'} 수준입니다.

3. 리스크 요인
현재 시장 상황에서 주의해야 할 리스크 요인을 상세히 분석하세요. 각 리스크는 2~3문장으로 설명하고, 
과거 유사한 상황에서의 실제 성과 데이터를 참고하여 작성하세요.

1) [첫 번째 리스크 요인]
   [상세 설명: 왜 리스크인지, 어떤 상황에서 발생할 수 있는지, 과거 사례 등]

2) [두 번째 리스크 요인]
   [상세 설명: 기술적 지표와의 연관성, 시장 환경과의 관계 등]

3) [세 번째 리스크 요인 (필요시)]
   [상세 설명: 거래량, 변동성, 외부 요인 등]

4. 정량적 전망 요약
위의 모든 분석을 종합하여 한 문단으로 요약하세요. 현재 시장 상황, 기술적 지표의 의미, 
예상되는 향후 움직임, 그리고 투자 시 주의사항을 포함하세요.

[2~3문장으로 상세한 전망과 결론을 제시. 과거 데이터 기반 인사이트를 포함하여 신뢰감 있게 작성]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. 맞춤 투자 전략 (${period.name})

⚠️ 중요: 이 섹션은 UI에 표시되므로 다음 규칙을 반드시 준수하세요.

📌 ${period.name} 전략 특성:
${investmentPeriod === 'swing' ? '- 단기 변동성 활용, 빠른 진입/청산\n- 3~7일 내 목표 달성 목표\n- 단기 기술적 지표 중심 판단' : investmentPeriod === 'medium' ? '- 중기 추세 추종 전략\n- 2~4주 내 추세 확인 후 진입\n- 중기 이동평균선과 추세선 활용' : '- 장기 성장 기대 전략\n- 1~3개월 저점 분할 매수\n- 장기 이동평균선과 펀더멘털 고려'}

1. 설명 길이: 모든 설명은 정확히 1문장으로 작성 (너무 길거나 짧지 않게)
2. 구체적 정보: 모든 근거에는 반드시 구체적 지표명과 수치 포함 (예: "RSI 55", "MACD 상향돌파", "MA20 14,584원")
3. 가격 정보: 모든 액션에는 가격 정보 포함 (예: "${targetPrice1.toLocaleString()}원 돌파 시 → 추가 30% 매수")
4. 손절가 표시: 1일차/1주차에 반드시 손절가 정보 포함 (UI에 표시됨) - ${period.name} 전략 손절가: ${stopLossPrice.toLocaleString()}원 (${period.stoploss})
5. 액션 명확화: "손절 준비" 같은 모호한 표현 금지, 구체적 액션 명시 (예: "포지션의 50% 청산")
6. 수익/손실 정보: 목표 달성 시 수익률, 손절 시 손실률 명시
7. 기간별 목표: ${period.name} 전략의 목표는 1차 ${targetPrice1.toLocaleString()}원 (+${period.target1Percent}%), 2차 ${targetPrice2.toLocaleString()}원 (+${period.target2Percent}%)입니다.

[1일차 또는 1주차: 초기 진입]
진입비율: [숫자만, 예: 40]% (시드의 [숫자]%)
진입타이밍: [1문장으로 간결하게, 예: 현재가 ${currentPrice.toLocaleString()}원 부근에서 분할 진입]
근거: [각 근거는 정확히 1문장으로 작성, 반드시 구체적 지표명과 수치 포함]
1) 기술적: [구체적 지표명과 수치, 판단을 1문장으로, 예: RSI ${latestIndicator.rsi ? latestIndicator.rsi.toFixed(2) : 'N/A'} 상승 + MACD Signal 상향돌파로 매수 신호]
2) 추세: [현재 추세와 구체적 수치를 1문장으로, 예: 현재가가 MA20(${ma20.toFixed(0)}원) 상회로 단기 상승 가능성 존재]
3) 지지/저항: [구체적 가격대와 의미를 1문장으로, 예: ${(currentPrice * 1.02).toLocaleString()}원 저항선과 ${(currentPrice * 0.98).toLocaleString()}원 지지선 사이 박스권 형성]
4) 거래량: [거래량 상태와 의미를 1문장으로, 예: 거래량 증가 시 모멘텀 강화 가능]

⚠️ 중요: 손절가 정보는 반드시 포함하세요. UI에 표시됩니다.
⚠️ ${period.name} 전략의 손절가는 ${stopLossPrice.toLocaleString()}원 (${period.stoploss})입니다.
손절가: ${stopLossPrice.toLocaleString()}원 (${period.stoploss})
손절타이밍: [1문장으로 간결하게, 예: 현재가가 손절가 하회 시 또는 MACD 지속 하락 시]
손절사유: [각 사유는 정확히 1문장으로 작성]
1) [하락 가능성과 리스크를 1문장으로, 예: 기술적 지표 약세로 추가 하락 가능성 존재]
2) [손실 확대 위험을 1문장으로, 예: 시장 방향성 불명확으로 손실 확대 위험]
3) [재진입 고려사항을 1문장으로, 예: 재진입은 MACD 상승세 전환 시 고려]

[2~3일차 또는 2~3주차: 상황별 대응]

⚠️ 중요: 각 시나리오의 액션에는 반드시 가격 정보를 포함하세요. 
⚠️ ${period.name} 전략에 맞는 목표가를 사용하세요: 1차 목표 ${targetPrice1.toLocaleString()}원 (+${period.target1Percent}%), 2차 목표 ${targetPrice2.toLocaleString()}원 (+${period.target2Percent}%)

상승 시나리오:
조건: [구체적 가격, 예: ${targetPrice1.toLocaleString()}원 돌파] AND [구체적 지표 조건, 예: RSI 55 이상]
액션: [가격 정보 포함, 예: ${targetPrice1.toLocaleString()}원 돌파 시 → 시드의 [숫자]% 추가 진입]
근거: [각 근거는 정확히 1문장으로 작성, 설명 길이 통일]
1) [가격 상승 의미를 1문장으로, 예: 가격 상승은 추세 전환 신호로 해석 가능]
2) [지표 개선 의미를 1문장으로, 예: 지표 개선은 모멘텀 강화의 의미]
3) [과거 패턴 참고를 1문장으로, 예: 과거 유사 패턴에서 상승 지속 가능성 높음]

횡보 시나리오:
조건: [가격 범위, 예: ${(currentPrice * 0.98).toLocaleString()}원 ~ ${(currentPrice * 1.02).toLocaleString()}원] 박스권 [기간, 예: 3일] 이상
액션: [가격 범위 포함, 예: ${(currentPrice * 0.98).toLocaleString()}원 ~ ${(currentPrice * 1.02).toLocaleString()}원 박스권 유지 시 → 현재 포지션 유지 또는 관망]
근거: [각 근거는 정확히 1문장으로 작성, 설명 길이 통일]
1) [방향성 불명확을 1문장으로, 예: 방향성 불명확으로 대기 필요]
2) [돌파/이탈 확인을 1문장으로, 예: 돌파/이탈 신호 확인 후 추가 조치 필요]

하락 시나리오:
조건: [구체적 가격, 예: ${stopLossPrice.toLocaleString()}원 하회] OR [구체적 지표 조건, 예: MACD 지속 하락]
⚠️ 중요: 액션은 "손절 준비"가 아닌 구체적 액션으로 작성하세요. 예: "포지션의 [숫자]% 청산" 또는 "손절가 하회 시 즉시 청산"
⚠️ ${period.name} 전략의 손절가는 ${stopLossPrice.toLocaleString()}원 (${period.stoploss})입니다.
액션: [가격 정보 포함, 구체적 액션 명시, 예: ${stopLossPrice.toLocaleString()}원 하회 시 → 포지션의 [숫자]% 청산]
근거: [각 근거는 정확히 1문장으로 작성, 설명 길이 통일]
1) [하락 추세 확정을 1문장으로, 예: 하락 추세 확정으로 손실 확대 위험]
2) [리스크 관리 필요를 1문장으로, 예: 추가 하락 가능성에 대한 리스크 관리 필요]
3) [재진입 타이밍을 1문장으로, 예: 재진입은 MACD 상승세 전환 시 고려]

[5~7일차 또는 4주차: 수익 실현]

⚠️ 중요: 각 액션에는 반드시 가격과 수익률 정보를 포함하세요.

1차 목표 달성 시:
가격: ${targetPrice1.toLocaleString()}원 (${period.name} 전략의 1차 목표, +${period.target1Percent}%)
액션: [가격과 수익률 포함, 예: ${targetPrice1.toLocaleString()}원 달성 시 → 포지션의 [숫자]% 익절 (예상 수익: +${period.target1Percent}.0%)]
근거: [각 근거는 정확히 1문장으로 작성, 설명 길이 통일]
1) [목표가 도달 의미를 1문장으로, 예: 목표가 도달로 수익 확보 필요]
2) [잔여 포지션 관리를 1문장으로, 예: 추가 상승 가능성 고려하여 잔여 포지션 관리]

2차 목표 달성 시:
가격: ${targetPrice2.toLocaleString()}원 (${period.name} 전략의 2차 목표, +${period.target2Percent}%)
액션: [가격과 수익률 포함, 예: ${targetPrice2.toLocaleString()}원 달성 시 → 포지션의 [숫자]% 익절 (예상 수익: +${period.target2Percent}.0%)]
근거: [각 근거는 정확히 1문장으로 작성, 설명 길이 통일]
1) [목표가 도달 의미를 1문장으로, 예: 목표가 도달로 추가 수익 실현]
2) [시장 상황 고려를 1문장으로, 예: 시장 상황에 따른 추가 전략 고려]

추가 전략: [각 항목은 1문장으로 간결하게]
1) 거래량: [조건과 액션을 1문장으로, 예: 거래량 50% 이상 증가 시 추가 진입 검토]
2) 시간: ${period.duration} 경과 시 [액션을 1문장으로, 예: 시장 반응 확인 후 재평가]
3) 시장상황: [조건과 액션을 1문장으로, 예: 주요 경제지표 발표 시 대응 전략 수립]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

  async getLatestReport(symbolId: string, timeframe?: string, userId?: string) {
    const query: any = {
      symbolId: new Types.ObjectId(symbolId),
      // ✅ timeframe 필터 제거 - 투자 기간 상관없이 가장 최근 리포트 반환
    };

    // ✅ userId 필터링
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
      correct: report.actualOutcome?.wasDirectionCorrect || null,
      confidence: report.metadata?.confidence ? Math.round(report.metadata.confidence * 100) : null,
      reportId: report._id,
    }));
  }

  async getBacktestingStats(symbolId: string, userId: string) {
    const reports = await this.aiReportModel
      .find({ 
        symbolId: new Types.ObjectId(symbolId),
        userId: new Types.ObjectId(userId),
        'actualOutcome.wasDirectionCorrect': { $exists: true }
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
    const correctPredictions = reports.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
    const accuracy = (correctPredictions / totalPredictions * 100).toFixed(0);

    const buyReports = reports.filter(r => r.predictedAction?.includes('매수'));
    const buyCorrect = buyReports.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
    const buyAccuracy = buyReports.length > 0 ? (buyCorrect / buyReports.length * 100).toFixed(0) : 0;

    const sellReports = reports.filter(r => r.predictedAction?.includes('매도') || r.predictedAction?.includes('주의'));
    const sellCorrect = sellReports.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
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
    const correct = filtered.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
    return {
      count: filtered.length,
      accuracy: filtered.length > 0 ? parseFloat((correct / filtered.length * 100).toFixed(0)) : 0,
    };
  }

  /**
   * 플랫폼 전체 통계 (모든 사용자 통합)
   */
  async getPlatformStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const reports = await this.aiReportModel
      .find({ 
        createdAt: { $gte: thirtyDaysAgo },
        'actualOutcome.wasDirectionCorrect': { $exists: true }
      })
      .lean();

    if (reports.length === 0) {
      return this.getEmptyStats();
    }

    return this.calculateStats(reports);
  }

  /**
   * 내 통합 통계 (모든 종목 통합)
   */
  async getMyStats(userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const reports = await this.aiReportModel
      .find({ 
        userId: new Types.ObjectId(userId),
        createdAt: { $gte: thirtyDaysAgo },
        'actualOutcome.wasDirectionCorrect': { $exists: true }
      })
      .lean();

    if (reports.length === 0) {
      return this.getEmptyStats();
    }

    return this.calculateStats(reports);
  }

  /**
   * 통계 계산 (공통 로직)
   */
  private calculateStats(reports: any[]) {
    const totalAnalysis = reports.length;
    
    // 방향 정확도
    const directionCorrect = reports.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
    const directionAccuracy = parseFloat((directionCorrect / totalAnalysis * 100).toFixed(1));
    
    // 1차 목표 달성률
    const target1Achieved = reports.filter(r => r.actualOutcome?.wasTarget1Achieved).length;
    const target1AchievementRate = parseFloat((target1Achieved / totalAnalysis * 100).toFixed(1));
    
    // 2차 목표 달성률
    const target2Achieved = reports.filter(r => r.actualOutcome?.wasTarget2Achieved).length;
    const target2AchievementRate = parseFloat((target2Achieved / totalAnalysis * 100).toFixed(1));
    
    // 평균 수익률
    const buyReports = reports.filter(r => r.predictedAction?.includes('매수'));
    const avgProfit = buyReports.length > 0
      ? buyReports.reduce((sum, r) => sum + (r.actualOutcome?.priceChangePercent || 0), 0) / buyReports.length
      : 0;
    
    // 투자 기간별 통계
    const byPeriod = {
      swing: this.calculatePeriodStats(reports.filter(r => r.investmentPeriod === 'swing')),
      medium: this.calculatePeriodStats(reports.filter(r => r.investmentPeriod === 'medium')),
      long: this.calculatePeriodStats(reports.filter(r => r.investmentPeriod === 'long')),
    };
    
    // 액션별 통계
    const byAction = {
      strongBuy: this.calculateActionStatsDetailed(reports, '강력 매수'),
      buy: this.calculateActionStatsDetailed(reports, '매수'),
      hold: this.calculateActionStatsDetailed(reports, '관망'),
      caution: this.calculateActionStatsDetailed(reports, '주의'),
      sell: this.calculateActionStatsDetailed(reports, '매도'),
    };

    return {
      totalAnalysis,
      directionAccuracy,
      target1AchievementRate,
      target2AchievementRate,
      avgProfit: parseFloat(avgProfit.toFixed(2)),
      byPeriod,
      byAction,
    };
  }

  /**
   * 기간별 통계 계산
   */
  private calculatePeriodStats(reports: any[]) {
    if (reports.length === 0) {
      return {
        count: 0,
        target1Rate: 0,
        target2Rate: 0,
        avgProfit: 0,
      };
    }

    const target1Achieved = reports.filter(r => r.actualOutcome?.wasTarget1Achieved).length;
    const target2Achieved = reports.filter(r => r.actualOutcome?.wasTarget2Achieved).length;
    const buyReports = reports.filter(r => r.predictedAction?.includes('매수'));
    const avgProfit = buyReports.length > 0
      ? buyReports.reduce((sum, r) => sum + (r.actualOutcome?.priceChangePercent || 0), 0) / buyReports.length
      : 0;

    return {
      count: reports.length,
      target1Rate: parseFloat((target1Achieved / reports.length * 100).toFixed(1)),
      target2Rate: parseFloat((target2Achieved / reports.length * 100).toFixed(1)),
      avgProfit: parseFloat(avgProfit.toFixed(2)),
    };
  }

  /**
   * 액션별 상세 통계
   */
  private calculateActionStatsDetailed(reports: any[], action: string) {
    const filtered = reports.filter(r => r.predictedAction === action);
    
    if (filtered.length === 0) {
      return {
        count: 0,
        directionAccuracy: 0,
        target1Rate: 0,
        target2Rate: 0,
        avgProfit: 0,
      };
    }

    const directionCorrect = filtered.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
    const target1Achieved = filtered.filter(r => r.actualOutcome?.wasTarget1Achieved).length;
    const target2Achieved = filtered.filter(r => r.actualOutcome?.wasTarget2Achieved).length;
    const avgProfit = filtered
      .filter(r => r.actualOutcome?.priceChangePercent !== undefined)
      .reduce((sum, r) => sum + (r.actualOutcome?.priceChangePercent || 0), 0) / filtered.length;

    return {
      count: filtered.length,
      directionAccuracy: parseFloat((directionCorrect / filtered.length * 100).toFixed(1)),
      target1Rate: parseFloat((target1Achieved / filtered.length * 100).toFixed(1)),
      target2Rate: parseFloat((target2Achieved / filtered.length * 100).toFixed(1)),
      avgProfit: parseFloat(avgProfit.toFixed(2)),
    };
  }

  /**
   * 빈 통계 반환
   */
  private getEmptyStats() {
    return {
      totalAnalysis: 0,
      directionAccuracy: 0,
      target1AchievementRate: 0,
      target2AchievementRate: 0,
      avgProfit: 0,
      byPeriod: {
        swing: { count: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        medium: { count: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        long: { count: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
      },
      byAction: {
        strongBuy: { count: 0, directionAccuracy: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        buy: { count: 0, directionAccuracy: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        hold: { count: 0, directionAccuracy: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        caution: { count: 0, directionAccuracy: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
        sell: { count: 0, directionAccuracy: 0, target1Rate: 0, target2Rate: 0, avgProfit: 0 },
      },
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
      const successCases = filteredReports.filter(r => r.actualOutcome?.wasDirectionCorrect).length;
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

  // 🆕 투자 전략 파싱 함수 (이모지/Phase 제거된 새 형식)
  private parseInvestmentStrategy(content: string, entryPrice: number): any {
    try {
      // 5번 섹션 찾기
      const strategySectionMatch = content.match(/5\.\s+.*맞춤\s*투자\s*전략[\s\S]*?(?=━━|※|$)/);
      if (!strategySectionMatch) {
        console.warn('⚠️ 전략 섹션을 찾을 수 없습니다');
        return null;
      }
      
      const strategyContent = strategySectionMatch[0];
      console.log('✅ 전략 섹션 찾음, 길이:', strategyContent.length);
      
      // 초기 진입 파싱 (더 유연한 정규식 - 여러 형식 지원)
      // phase1Match는 선택사항으로 변경 (entryRatioMatch만으로도 충분)
      const phase1Match = strategyContent.match(/\[1일차[^\]]*: 초기 진입\]|\[1주차[^\]]*: 초기 진입\]|1일차.*초기 진입|1주차.*초기 진입|초기 진입/i);
      const entryRatioMatch = strategyContent.match(/진입비율:\s*(\d+)%/);
      // 진입타이밍은 "근거:" 전까지만 파싱
      const entryTimingMatch = strategyContent.match(/진입타이밍:\s*([^\n]+(?:\n(?!근거:|손절가:|⚠️|\[2~3일차|\[2~3주차|상승 시나리오:)[^\n]+)*)/);
      const reasoningMatch = strategyContent.match(/근거:\s*([\s\S]*?)(?=손절가:|⚠️|\[2~3일차|\[2~3주차|상승 시나리오:|$)/);
      
      console.log('🔍 Phase1 파싱 결과:', {
        phase1Match: !!phase1Match,
        entryRatioMatch: !!entryRatioMatch,
        entryTimingMatch: !!entryTimingMatch,
        reasoningMatch: !!reasoningMatch
      });
      // 손절 정보 파싱 (더 유연하게)
      const stopLossPriceMatch = strategyContent.match(/손절가:\s*([\d,]+)원/);
      const stopLossPercentMatch = strategyContent.match(/손절가:\s*[\d,]+원\s*\(([^)]+)\)/);
      const stopLossTimingMatch = strategyContent.match(/손절타이밍:\s*([^\n]+)/);
      const stopLossReasonMatch = strategyContent.match(/손절사유:\s*([\s\S]*?)(?=\[2~3일차|\[2~3주차|상승 시나리오:|횡보 시나리오:|하락 시나리오:|$)/);
      
      // 상황별 대응 파싱 (strategyContent 사용) - 액션 필드 여러 줄 지원
      const bullishMatch = strategyContent.match(/상승 시나리오:\s*조건:\s*([^\n]+)[\s\S]*?액션:\s*([^\n]+(?:\n(?!근거:|횡보 시나리오:|하락 시나리오:|\[5~7일차|\[4주차)[^\n]+)*)[\s\S]*?근거:\s*([\s\S]*?)(?=횡보 시나리오:|하락 시나리오:|\[5~7일차|\[4주차|$)/);
      const sidewaysMatch = strategyContent.match(/횡보 시나리오:\s*조건:\s*([^\n]+)[\s\S]*?액션:\s*([^\n]+(?:\n(?!근거:|하락 시나리오:|\[5~7일차|\[4주차)[^\n]+)*)[\s\S]*?근거:\s*([\s\S]*?)(?=하락 시나리오:|\[5~7일차|\[4주차|$)/);
      const bearishMatch = strategyContent.match(/하락 시나리오:\s*조건:\s*([^\n]+)[\s\S]*?액션:\s*([^\n]+(?:\n(?!근거:|\[5~7일차|\[4주차)[^\n]+)*)[\s\S]*?근거:\s*([\s\S]*?)(?=\[5~7일차|\[4주차|$)/);
      
      // 수익 실현 파싱 (strategyContent 사용) - 액션 필드 여러 줄 지원
      const target1ExitMatch = strategyContent.match(/1차 목표 달성 시:\s*가격:\s*([^\n]+)[\s\S]*?액션:\s*([^\n]+(?:\n(?!근거:|2차 목표 달성 시:|추가 전략:)[^\n]+)*)[\s\S]*?근거:\s*([\s\S]*?)(?=2차 목표 달성 시:|추가 전략:|$)/);
      const target2ExitMatch = strategyContent.match(/2차 목표 달성 시:\s*가격:\s*([^\n]+)[\s\S]*?액션:\s*([^\n]+(?:\n(?!근거:|추가 전략:)[^\n]+)*)[\s\S]*?근거:\s*([\s\S]*?)(?=추가 전략:|$)/);
      const additionalMatch = strategyContent.match(/추가 전략:\s*([\s\S]*?)(?=━━|※|$)/);
      
      // Phase3 파싱
      console.log('🔍 Phase3 파싱 결과:', {
        target1ExitMatch: !!target1ExitMatch,
        target2ExitMatch: !!target2ExitMatch,
        additionalMatch: !!additionalMatch
      });

      const strategy: any = {};

      // Phase1 파싱 (더 유연하게 - entryRatioMatch만 있어도 파싱)
      if (entryRatioMatch) {
        const entryRatio = parseInt(entryRatioMatch[1]);
        let entryTiming = entryTimingMatch ? entryTimingMatch[1].trim() : '';
        // "근거:" 이후 텍스트 제거
        if (entryTiming.includes('근거:')) {
          entryTiming = entryTiming.split('근거:')[0].trim();
        }
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';
        
        let stopLoss: any = null;
        if (stopLossPriceMatch || stopLossTimingMatch || stopLossReasonMatch) {
          const stopLossPrice = stopLossPriceMatch ? parseInt(stopLossPriceMatch[1].replace(/,/g, '')) : null;
          const stopLossPercentStr = stopLossPercentMatch ? stopLossPercentMatch[1] : '';
          const stopLossPercent = parseFloat(stopLossPercentStr.match(/-?([\d.]+)%/)?.[1] || '0');
          const stopLossTiming = stopLossTimingMatch ? stopLossTimingMatch[1].trim() : '';
          const stopLossReason = stopLossReasonMatch ? stopLossReasonMatch[1].trim() : '';
          
          if (stopLossPrice) {
            stopLoss = {
            price: stopLossPrice,
            percent: -Math.abs(stopLossPercent),
              timing: stopLossTiming,
              reason: stopLossReason
            };
          }
        }
        
        strategy.phase1 = {
          entryRatio,
          entryTiming,
          reasoning,
          stopLoss
        };
        
        console.log('✅ Phase1 파싱 성공:', {
          entryRatio,
          hasEntryTiming: !!entryTiming,
          hasReasoning: !!reasoning,
          hasStopLoss: !!stopLoss
        });
      } else {
        console.warn('⚠️ Phase1 파싱 실패: entryRatioMatch 없음', {
          phase1Match: !!phase1Match,
          entryRatioMatch: !!entryRatioMatch,
          strategyContentPreview: strategyContent.substring(0, 1000) // 처음 1000자 출력
        });
      }

      // Phase2 파싱
      console.log('🔍 Phase2 파싱 결과:', {
        bullishMatch: !!bullishMatch,
        sidewaysMatch: !!sidewaysMatch,
        bearishMatch: !!bearishMatch
      });

      if (bullishMatch || sidewaysMatch || bearishMatch) {
        strategy.phase2 = {};
        
        if (bullishMatch) {
          // 액션에서 "→" 이후만 추출 (예: "15,079원 돌파 시 → 시드의 30% 추가 진입" → "시드의 30% 추가 진입")
          let actionText = bullishMatch[2].trim();
          // "→" 이후만 추출
          if (actionText.includes('→')) {
            actionText = actionText.split('→').slice(1).join('→').trim();
          }
          // JSON 문자열 제거 (혹시 모를 경우)
          actionText = actionText.replace(/\{[\s\S]*?\}/g, '').trim();
          const ratioMatch = actionText.match(/시드의\s*(\d+)%|(\d+)%\s*추가/);
          const actionRatio = ratioMatch ? parseInt(ratioMatch[1] || ratioMatch[2]) : 0;
          
          strategy.phase2.bullish = {
            condition: bullishMatch[1].trim(),
            action: actionText, // "→" 이후 액션만 포함
            actionRatio,
            reason: bullishMatch[3].trim()
          };
        }
        
        if (sidewaysMatch) {
          // 액션에서 "→" 이후만 추출
          let actionText = sidewaysMatch[2].trim();
          if (actionText.includes('→')) {
            actionText = actionText.split('→').slice(1).join('→').trim();
          }
          actionText = actionText.replace(/\{[\s\S]*?\}/g, '').trim();
          
          strategy.phase2.sideways = {
            condition: sidewaysMatch[1].trim(),
            action: actionText,
            reason: sidewaysMatch[3].trim()
          };
        }
        
        if (bearishMatch) {
          // 액션에서 "→" 이후만 추출 (예: "56,939원 하회 시 → 포지션의 50% 청산" → "포지션의 50% 청산")
          let actionText = bearishMatch[2].trim();
          if (actionText.includes('→')) {
            actionText = actionText.split('→').slice(1).join('→').trim();
          }
          actionText = actionText.replace(/\{[\s\S]*?\}/g, '').trim();
          const ratioMatch = actionText.match(/포지션의\s*(\d+)%|(\d+)%\s*청산/);
          const exitRatio = ratioMatch ? parseInt(ratioMatch[1] || ratioMatch[2]) : 100; // 기본값 100% (전량 청산)
          
          strategy.phase2.bearish = {
            condition: bearishMatch[1].trim(),
            action: actionText, // "→" 이후 액션만 포함
            exitRatio,
            reason: bearishMatch[3].trim()
          };
        }
      }

      if (target1ExitMatch || target2ExitMatch) {
        strategy.phase3 = {};
        
        if (target1ExitMatch) {
          // 액션에서 "→" 이후만 추출 및 불필요한 텍스트 제거
          let actionText = target1ExitMatch[2].trim();
          // "1차 목표 달성 시: 가격: 60,461원 액션: ..." 같은 형식에서 "액션:" 이후만 추출
          if (actionText.includes('액션:')) {
            actionText = actionText.split('액션:').slice(1).join('액션:').trim();
          }
          // 가격 정보 제거 (예: "60,461원 달성 시" 제거)
          actionText = actionText.replace(/[\d,]+원\s*(?:달성\s*시|돌파|하회)?\s*→?\s*/g, '').trim();
          // "→" 이후만 추출
          if (actionText.includes('→')) {
            actionText = actionText.split('→').slice(1).join('→').trim();
          }
          actionText = actionText.replace(/\{[\s\S]*?\}/g, '').trim();
          const ratioMatch = actionText.match(/포지션의\s*(\d+)%|(\d+)%\s*익절/);
          const exitRatio = ratioMatch ? parseInt(ratioMatch[1] || ratioMatch[2]) : 0;
          
          strategy.phase3.target1 = {
            price: target1ExitMatch[1].trim(),
            action: actionText, // 깨끗한 액션만 포함
            exitRatio,
            reason: target1ExitMatch[3].trim()
          };
        }
        
        if (target2ExitMatch) {
          // 액션에서 "→" 이후만 추출 및 불필요한 텍스트 제거
          let actionText = target2ExitMatch[2].trim();
          // "2차 목표 달성 시: 가격: 61,635원 액션: ..." 같은 형식에서 "액션:" 이후만 추출
          if (actionText.includes('액션:')) {
            actionText = actionText.split('액션:').slice(1).join('액션:').trim();
          }
          // 가격 정보 제거
          actionText = actionText.replace(/[\d,]+원\s*(?:달성\s*시|돌파|하회)?\s*→?\s*/g, '').trim();
          // "→" 이후만 추출
          if (actionText.includes('→')) {
            actionText = actionText.split('→').slice(1).join('→').trim();
          }
          actionText = actionText.replace(/\{[\s\S]*?\}/g, '').trim();
          const ratioMatch = actionText.match(/포지션의\s*(\d+)%|(\d+)%\s*익절/);
          const exitRatio = ratioMatch ? parseInt(ratioMatch[1] || ratioMatch[2]) : 0;
          
          strategy.phase3.target2 = {
            price: target2ExitMatch[1].trim(),
            action: actionText, // 깨끗한 액션만 포함
            exitRatio,
            reason: target2ExitMatch[3].trim()
          };
        }
        
        if (additionalMatch) {
          strategy.phase3.additional = additionalMatch[1].trim();
        }
      }

      if (Object.keys(strategy).length > 0) {
        console.log('✅ 전략 파싱 성공:', {
          phase1: !!strategy.phase1,
          phase2: !!strategy.phase2,
          phase3: !!strategy.phase3,
          phase1Keys: strategy.phase1 ? Object.keys(strategy.phase1) : [],
          phase2Keys: strategy.phase2 ? Object.keys(strategy.phase2) : [],
          phase3Keys: strategy.phase3 ? Object.keys(strategy.phase3) : [],
          fullStrategy: JSON.stringify(strategy, null, 2)
        });
        
        // 모든 Phase가 있어야 완전한 전략
        if (!strategy.phase1 || !strategy.phase2 || !strategy.phase3) {
          console.warn('⚠️ 전략 파싱 불완전:', {
            phase1: !!strategy.phase1,
            phase2: !!strategy.phase2,
            phase3: !!strategy.phase3,
            phase1Details: strategy.phase1,
            phase2Details: strategy.phase2,
            phase3Details: strategy.phase3
          });
        }
        
        return strategy;
      } else {
        console.warn('⚠️ 전략 파싱 실패: 파싱된 섹션이 없습니다', {
          phase1Match: !!phase1Match,
          entryRatioMatch: !!entryRatioMatch,
          bullishMatch: !!bullishMatch,
          sidewaysMatch: !!sidewaysMatch,
          bearishMatch: !!bearishMatch,
          target1ExitMatch: !!target1ExitMatch,
          target2ExitMatch: !!target2ExitMatch,
          strategyContentPreview: strategyContent.substring(0, 500) // 처음 500자만 출력
        });
        return null;
      }
    } catch (error) {
      console.error('Strategy parsing error:', error);
      return null;
    }
  }
}



