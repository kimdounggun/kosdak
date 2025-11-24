import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SymbolDocument = Symbol & Document;

@Schema({ timestamps: true })
export class Symbol {
  @Prop({ required: true, enum: ['KOSPI', 'KOSDAQ'] })
  market: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  sector?: string;

  @Prop()
  description?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const SymbolSchema = SchemaFactory.createForClass(Symbol);

// Create compound index for market and code
SymbolSchema.index({ market: 1, code: 1 }, { unique: true });

