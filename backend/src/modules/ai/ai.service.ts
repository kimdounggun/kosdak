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

    const prompt = this.buildPrompt(symbol, candles, indicators, reportType);

    let content = '';
    let metadata: any = {
      priceAtGeneration: latestCandle.close,
      candlesAnalyzed: candles.length,
      model: 'gpt-4',
    };

    if (latestIndicator) {
      metadata.rsiAtGeneration = latestIndicator.rsi;
      metadata.volumeAtGeneration = latestCandle.volume;
    }

    // Generate AI report
    if (this.openai) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
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
      } catch (error) {
        console.error('OpenAI API error:', error);
        content = this.generateFallbackReport(symbol, latestCandle, latestIndicator);
      }
    } else {
      content = this.generateFallbackReport(symbol, latestCandle, latestIndicator);
    }

    // Save report
    const report = new this.aiReportModel({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      symbolId: new Types.ObjectId(symbolId),
      timeframe,
      reportType,
      content,
      metadata,
      validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000), // Valid for 6 hours
    });

    return report.save();
  }

  private buildPrompt(symbol: any, candles: any[], indicators: any[], reportType: string): string {
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 형식으로 출력하세요:

1. 시장 포지션
현재 추세는 [상승/하락/횡보]이며, 강도는 [약함/중간/강함]. [지표 근거 포함해 1~2문장]

2. 핵심 매매 시그널
- RSI: [수치 및 판단]
- MACD: [수치, 방향 및 판단]
- 이동평균선: [MA20/MA60 관계 및 판단]

3. 실전 투자 전략
권장 포지션: [강력 매수/매수/관망/주의/매도]
상승 확률: [X]% (근거: [RSI 구간 판단] + [MACD 방향] + [이평선 배열])
리스크 레벨: [낮음/중간/높음]
진입가: ${currentPrice.toLocaleString()}원 (현재가 기준)
손절가: [구체적 금액]원
1차 목표가: [구체적 금액]원
2차 목표가: [구체적 금액]원
보유 기간: [단기/중기/장기]

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

  async getLatestReport(symbolId: string, timeframe: string = '5m', userId?: string) {
    const query: any = {
      symbolId: new Types.ObjectId(symbolId),
      timeframe,
      validUntil: { $gt: new Date() },
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
}



