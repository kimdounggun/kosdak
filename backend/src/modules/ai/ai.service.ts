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
              content: '당신은 한국 주식 시장의 전문 애널리스트입니다. 기술적 분석을 기반으로 명확하고 실용적인 투자 인사이트를 제공합니다.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
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
    const latest = candles[0];
    const latestIndicator = indicators[0] || {};

    const priceChange = candles.length > 1 
      ? ((latest.close - candles[1].close) / candles[1].close * 100).toFixed(2)
      : '0';

    let prompt = `${symbol.name}(${symbol.code}) - ${symbol.market} 종목 분석\n\n`;
    prompt += `현재가: ${latest.close.toLocaleString()}원\n`;
    prompt += `전봉 대비: ${priceChange}%\n`;
    prompt += `거래량: ${latest.volume.toLocaleString()}\n\n`;

    if (latestIndicator.rsi) {
      prompt += `RSI(14): ${latestIndicator.rsi.toFixed(2)}\n`;
    }
    if (latestIndicator.macd) {
      prompt += `MACD: ${latestIndicator.macd.toFixed(2)}, Signal: ${latestIndicator.macdSignal?.toFixed(2)}\n`;
    }
    if (latestIndicator.ma20) {
      prompt += `MA20: ${latestIndicator.ma20.toFixed(0)}원\n`;
    }

    prompt += `\n최근 ${candles.length}개 봉 데이터를 기반으로 다음을 분석해주세요:\n\n`;

    switch (reportType) {
      case 'trend':
        prompt += '1. 현재 추세 방향 (상승/하락/횡보)\n2. 추세 강도\n3. 추세 지속 가능성';
        break;
      case 'volatility':
        prompt += '1. 현재 변동성 수준\n2. 가격 변동 패턴\n3. 리스크 평가';
        break;
      case 'volume':
        prompt += '1. 거래량 추이 분석\n2. 수급 상황\n3. 거래량 기반 신호';
        break;
      case 'support_resistance':
        prompt += '1. 주요 지지선\n2. 주요 저항선\n3. 돌파/이탈 가능성';
        break;
      default:
        prompt += '1. 현재 추세 및 강도\n2. 변동성 분석\n3. 수급/거래량 분석\n4. 주요 지지/저항 구간\n5. 단기/중기 전망 요약';
    }

    prompt += '\n\n명확하고 실용적인 한국어로 분석해주세요.';

    return prompt;
  }

  private generateFallbackReport(symbol: any, candle: any, indicator: any): string {
    let report = `${symbol.name}(${symbol.code}) 기술적 분석 리포트\n\n`;
    report += `현재가: ${candle.close.toLocaleString()}원\n`;
    report += `거래량: ${candle.volume.toLocaleString()}\n\n`;

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


