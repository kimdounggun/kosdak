import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationChannelDocument = NotificationChannel & Document;

@Schema({ timestamps: true })
export class NotificationChannel {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['sms', 'telegram', 'email', 'webhook'] })
  type: string;

  @Prop({ required: true })
  value: string; // Phone number, chat ID, email, or webhook URL

  @Prop({ default: false })
  verified: boolean;

  @Prop()
  verifiedAt?: Date;

  @Prop()
  verificationCode?: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop()
  name?: string;
}

export const NotificationChannelSchema = SchemaFactory.createForClass(NotificationChannel);

// Create indexes
NotificationChannelSchema.index({ userId: 1, type: 1 });













