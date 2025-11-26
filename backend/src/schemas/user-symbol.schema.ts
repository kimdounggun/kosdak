import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserSymbolDocument = UserSymbol & Document;

@Schema({ timestamps: true })
export class UserSymbol {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Symbol', required: true })
  symbolId: Types.ObjectId;

  @Prop({ default: true })
  alertEnabled: boolean;

  @Prop({ default: 0 })
  order: number;

  @Prop({ type: Object })
  customSettings?: Record<string, any>;
}

export const UserSymbolSchema = SchemaFactory.createForClass(UserSymbol);

// Create compound index
UserSymbolSchema.index({ userId: 1, symbolId: 1 }, { unique: true });



