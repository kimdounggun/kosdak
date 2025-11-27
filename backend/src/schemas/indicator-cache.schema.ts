import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type IndicatorCacheDocument = IndicatorCache & Document;

@Schema({ timestamps: true })
export class IndicatorCache {
  @Prop({ type: Types.ObjectId, ref: 'Symbol', required: true })
  symbolId: Types.ObjectId;

  @Prop({ required: true, enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] })
  timeframe: string;

  @Prop({ required: true })
  timestamp: Date;

  // RSI
  @Prop()
  rsi?: number;

  // MACD
  @Prop()
  macd?: number;

  @Prop()
  macdSignal?: number;

  @Prop()
  macdHist?: number;

  // Moving Averages
  @Prop()
  ma5?: number;

  @Prop()
  ma20?: number;

  @Prop()
  ma60?: number;

  @Prop()
  ma120?: number;

  // Bollinger Bands
  @Prop()
  bbUpper?: number;

  @Prop()
  bbMiddle?: number;

  @Prop()
  bbLower?: number;

  // Stochastic
  @Prop()
  stochK?: number;

  @Prop()
  stochD?: number;

  // Volume indicators
  @Prop()
  volumeMA?: number;

  @Prop()
  volumeRatio?: number;

  @Prop({ type: Object })
  additionalIndicators?: Record<string, any>;
}

export const IndicatorCacheSchema = SchemaFactory.createForClass(IndicatorCache);

// Create compound indexes
IndicatorCacheSchema.index({ symbolId: 1, timeframe: 1, timestamp: -1 });







