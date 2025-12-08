import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlertLogDocument = AlertLog & Document;

@Schema({ timestamps: false })
export class AlertLog {
  @Prop({ type: Types.ObjectId, ref: 'Alert', required: true })
  alertId: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  triggeredAt: Date;

  @Prop({ type: Object, required: true })
  snapshotJson: {
    price?: number;
    volume?: number;
    indicators?: Record<string, number>;
    conditionsMet?: string[];
    [key: string]: any;
  };

  @Prop({ default: false })
  notificationSent: boolean;

  @Prop()
  notificationChannel?: string;

  @Prop()
  notificationError?: string;

  @Prop()
  sentAt?: Date;
}

export const AlertLogSchema = SchemaFactory.createForClass(AlertLog);

// Create indexes
AlertLogSchema.index({ alertId: 1, triggeredAt: -1 });
AlertLogSchema.index({ triggeredAt: -1 });
























