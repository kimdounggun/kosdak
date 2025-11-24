import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlertDocument = Alert & Document;

export interface AlertCondition {
  type: 'indicator' | 'price' | 'volume' | 'custom';
  operator: '>' | '<' | '>=' | '<=' | '==' | 'crossAbove' | 'crossBelow';
  indicator?: string; // e.g., 'rsi', 'macd', 'ma20'
  value?: number;
  timeframe?: string;
  compareWith?: string; // for comparing two indicators
  customExpression?: string;
}

@Schema({ timestamps: true })
export class Alert {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Symbol', required: true })
  symbolId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: true })
  active: boolean;

  @Prop({ type: Object, required: true })
  conditionJson: AlertCondition[];

  @Prop({ default: 'all', enum: ['all', 'any'] })
  conditionLogic: string; // 'all' = AND, 'any' = OR

  @Prop({ default: 0 })
  cooldownMinutes: number; // Prevent repeated alerts

  @Prop()
  lastTriggeredAt?: Date;

  @Prop({ default: 0 })
  triggerCount: number;

  @Prop({ default: ['sms'] })
  notificationChannels: string[];
}

export const AlertSchema = SchemaFactory.createForClass(Alert);

// Create indexes
AlertSchema.index({ userId: 1, active: 1 });
AlertSchema.index({ symbolId: 1, active: 1 });

