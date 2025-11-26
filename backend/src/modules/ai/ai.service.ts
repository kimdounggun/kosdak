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
              content: '당신은 20년 경력의 한국 주식 시장 전문 애널리스트입니다. 기술적 분석을 기반으로 구체적이고 실용적인 투자 전략을 제공합니다. 항상 명확한 가격대(진입가, 손절가, 목표가)를 제시하며, 일관된 형식으로 분석합니다.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.5,  // 더 일관된 분석을 위해 낮춤
          max_tokens: 1500,  // 더 상세한 분석을 위해 증가
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

    let prompt = `당신은 20년 경력의 한국 주식 시장 전문 애널리스트입니다. 기술적 분석과 차트 패턴을 기반으로 실전 투자에 도움이 되는 구체적인 인사이트를 제공합니다.

[종목 정보]
• 종목명: ${symbol.name} (${symbol.code})
• 시장: ${symbol.market}

[현재 시세] (20분 지연)
• 현재가: ${currentPrice.toLocaleString()}원
• 등락: ${changeAmount >= 0 ? '+' : ''}${changeAmount.toLocaleString()}원 (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)
• 시가: ${dayOpen.toLocaleString()}원
• 고가: ${dayHigh.toLocaleString()}원 (상승폭 ${((dayHigh - dayOpen) / dayOpen * 100).toFixed(2)}%)
• 저가: ${dayLow.toLocaleString()}원 (하락폭 ${((dayOpen - dayLow) / dayOpen * 100).toFixed(2)}%)
• 당일 거래량: ${volumeToDisplay.toLocaleString()}주 (평균 대비 ${volumeRatio.toFixed(1)}배, ${volumeStatus})

[기술적 지표]
`;

    if (latestIndicator.rsi) {
      prompt += `• RSI(14): ${latestIndicator.rsi.toFixed(2)} (${rsiStatus})\n`;
    }
    if (latestIndicator.macd && latestIndicator.macdSignal) {
      prompt += `• MACD: ${latestIndicator.macd.toFixed(2)}, Signal: ${latestIndicator.macdSignal.toFixed(2)} (${macdSignal} 신호)\n`;
      prompt += `  Histogram: ${(latestIndicator.macd - latestIndicator.macdSignal).toFixed(2)}\n`;
    }
    if (latestIndicator.ma5 && latestIndicator.ma20) {
      prompt += `• 이동평균선: MA5(${ma5.toFixed(0)}), MA20(${ma20.toFixed(0)})`;
      if (latestIndicator.ma60) {
        prompt += `, MA60(${ma60.toFixed(0)})`;
      }
      prompt += ` → ${maAlignment}\n`;
      prompt += `  현재가 vs MA20: ${currentPrice > ma20 ? '상회' : '하회'} (${((currentPrice - ma20) / ma20 * 100).toFixed(2)}%)\n`;
    }
    if (latestIndicator.bbUpper && latestIndicator.bbLower && latestIndicator.bbMiddle) {
      prompt += `• 볼린저밴드: 상단(${latestIndicator.bbUpper.toFixed(0)}), 중간(${latestIndicator.bbMiddle.toFixed(0)}), 하단(${latestIndicator.bbLower.toFixed(0)})\n`;
      const bbPosition = ((currentPrice - latestIndicator.bbLower) / (latestIndicator.bbUpper - latestIndicator.bbLower) * 100).toFixed(0);
      prompt += `  현재 위치: ${bbPosition}% (0%=하단, 100%=상단)\n`;
    }
    if (latestIndicator.stochK && latestIndicator.stochD) {
      prompt += `• Stochastic: K(${latestIndicator.stochK.toFixed(2)}), D(${latestIndicator.stochD.toFixed(2)})\n`;
    }

    prompt += `
[최근 가격 동향]
• 최근 ${Math.min(candles.length, 10)}개 봉 데이터 분석 가능
• 5분봉 기준 단기 추세 파악

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

반드시 아래 형식을 정확히 따라 분석하세요. 각 섹션 사이에 빈 줄을 추가하세요:

1. 시장 포지션
현재 추세는 [상승/하락/횡보]이며, [강도 설명]. [추가 설명 1-2문장]

2. 핵심 매매 시그널
- [지표1]: [판단 근거]
- [지표2]: [판단 근거]
- [지표3]: [판단 근거]

3. 리스크 요인
- [리스크1 설명]
- [리스크2 설명]

4. 실전 투자 전략
권장 포지션: [강력 매수/매수/관망/주의/매도]
적정 진입가: [구체적 금액]원 (현재가 대비 [±X]%)
손절가: [구체적 금액]원 (-[X]%)
1차 목표가: [구체적 금액]원 (+[X]%)
2차 목표가: [구체적 금액]원 (+[X]%)
보유 기간: [단기/중기/장기]

5. 한줄 요약
[30자 이내 핵심 메시지]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[중요 고지사항]
이 분석은 20분 지연 시세를 기반으로 하며, 투자 권유가 아닌 참고 정보 제공 목적입니다. 최종 투자 판단은 본인의 책임입니다.
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



