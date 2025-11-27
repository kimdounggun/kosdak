import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AiReportDocument = AiReport & Document;

@Schema({ timestamps: true })
export class AiReport {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Symbol', required: true })
  symbolId: Types.ObjectId;

  @Prop({ required: true, enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] })
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
    wasCorrect?: boolean; // AI 예측이 맞았는지
    correctnessScore?: number; // 0~100 점수
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




