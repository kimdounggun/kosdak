import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AiReportDocument = AiReport & Document;

@Schema({ timestamps: true })
export class AiReport {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Symbol', required: true })
  symbolId: Types.ObjectId;

  @Prop({ required: true, enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] })
  timeframe: string;

  @Prop({ 
    required: true, 
    enum: ['trend', 'volatility', 'volume', 'support_resistance', 'comprehensive'] 
  })
  reportType: string;

  @Prop({ required: true, type: String })
  content: string;

  @Prop({ type: Object })
  metadata?: {
    priceAtGeneration?: number;
    rsiAtGeneration?: number;
    volumeAtGeneration?: number;
    candlesAnalyzed?: number;
    model?: string;
    modelVersion?: string;
    confidence?: number;
    processingTimeMs?: number;
    tokensUsed?: number;
    targetPrice1?: number;      // AI가 제시한 1차 목표가
    targetPrice2?: number;      // AI가 제시한 2차 목표가
    targetPercent1?: number;    // 1차 목표 수익률 (%)
    targetPercent2?: number;    // 2차 목표 수익률 (%)
    strategy?: {                // 🆕 AI 투자 전략
      phase1?: {
        entryRatio?: number;    // 진입 비율 (%)
        entryTiming?: string;  // 진입 타이밍
        reasoning?: string;     // 진입 근거
        stopLoss?: {
          price?: number;       // 손절가
          percent?: number;     // 손절 비율 (%)
          timing?: string;      // 손절 타이밍
          reason?: string;      // 손절 사유
        };
      };
      phase2?: {
        bullish?: {
          condition?: string;   // 상승 조건
          action?: string;      // 액션 (전체 텍스트)
          actionRatio?: number; // 추가 진입 비율 (%)
          reason?: string;      // 근거
        };
        sideways?: {
          condition?: string;   // 횡보 조건
          action?: string;      // 액션
          reason?: string;      // 근거
        };
        bearish?: {
          condition?: string;   // 하락 조건
          action?: string;      // 액션 (전체 텍스트)
          exitRatio?: number;   // 청산 비율 (%)
          reason?: string;      // 근거
        };
      };
      phase3?: {
        target1?: {
          price?: string;       // 1차 목표가
          action?: string;      // 액션 (전체 텍스트)
          exitRatio?: number;   // 익절 비율 (%)
          reason?: string;      // 근거
        };
        target2?: {
          price?: string;       // 2차 목표가
          action?: string;      // 액션 (전체 텍스트)
          exitRatio?: number;   // 익절 비율 (%)
          reason?: string;      // 근거
        };
        additional?: string;    // 추가 전략
      };
    };
    [key: string]: any;
  };

  @Prop({ type: Object })
  analysisProcess?: {
    step1?: { status: string; result: string; details: any };
    step2?: { status: string; result: string; details: any };
    step3?: { status: string; result: string; details: any };
  };

  @Prop({ type: Object })
  explainability?: {
    factors?: Array<{ name: string; weight: number; impact: string }>;
    reasoning?: string;
    alternatives?: string;
  };

  @Prop({ type: String })
  rawResponse?: string;

  @Prop()
  validUntil?: Date;

  @Prop({ default: false })
  isStale: boolean;

  // 실제 결과 추적 (백테스팅용)
  @Prop({ type: Object })
  actualOutcome?: {
    priceAfter24h?: number;
    priceChangePercent?: number;
    recordedAt?: Date;
    wasDirectionCorrect?: boolean;   // 방향만 맞았는지 (기존 wasCorrect)
    wasTarget1Achieved?: boolean;    // 1차 목표가 달성 여부
    wasTarget2Achieved?: boolean;    // 2차 목표가 달성 여부
    correctnessScore?: number;       // 0~100 점수
  };

  // AI 예측 정보 (비교용)
  @Prop({ type: String })
  predictedAction?: string; // '강력 매수', '매수', '관망', '주의', '매도'

  @Prop({ type: String })
  investmentPeriod?: string; // 'swing', 'medium', 'long'
}

export const AiReportSchema = SchemaFactory.createForClass(AiReport);

// Create indexes
AiReportSchema.index({ symbolId: 1, timeframe: 1, createdAt: -1 });
AiReportSchema.index({ userId: 1, createdAt: -1 });




