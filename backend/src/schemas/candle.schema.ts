import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CandleDocument = Candle & Document;

@Schema({ timestamps: true })
export class Candle {
  @Prop({ type: Types.ObjectId, ref: 'Symbol', required: true })
  symbolId: Types.ObjectId;

  @Prop({ required: true, enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] })
  timeframe: string;

  @Prop({ required: true })
  timestamp: Date;

  @Prop({ required: true })
  open: number;

  @Prop({ required: true })
  high: number;

  @Prop({ required: true })
  low: number;

  @Prop({ required: true })
  close: number;

  @Prop({ required: true })
  volume: number;

  @Prop()
  sourceUpdatedAt?: Date;

  @Prop()
  isDelayed: boolean;

  @Prop()
  delayMinutes?: number;
}

export const CandleSchema = SchemaFactory.createForClass(Candle);

// Create compound indexes
CandleSchema.index({ symbolId: 1, timeframe: 1, timestamp: -1 });
CandleSchema.index({ timestamp: -1 });













