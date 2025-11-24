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
    [key: string]: any;
  };

  @Prop()
  validUntil?: Date;

  @Prop({ default: false })
  isStale: boolean;
}

export const AiReportSchema = SchemaFactory.createForClass(AiReport);

// Create indexes
AiReportSchema.index({ symbolId: 1, timeframe: 1, createdAt: -1 });
AiReportSchema.index({ userId: 1, createdAt: -1 });

