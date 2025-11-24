import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Candle, CandleDocument } from '../../schemas/candle.schema';

@Injectable()
export class CandlesService {
  constructor(
    @InjectModel(Candle.name) private candleModel: Model<CandleDocument>,
  ) {}

  async create(candleData: Partial<Candle>): Promise<CandleDocument> {
    const candle = new this.candleModel(candleData);
    return candle.save();
  }

  async bulkCreate(candles: Partial<Candle>[]): Promise<any[]> {
    return this.candleModel.insertMany(candles);
  }

  async findBySymbol(
    symbolId: string,
    timeframe: string,
    limit: number = 200,
    startTime?: Date,
    endTime?: Date,
  ) {
    const query: any = {
      symbolId: new Types.ObjectId(symbolId),
      timeframe,
    };

    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = startTime;
      if (endTime) query.timestamp.$lte = endTime;
    }

    return this.candleModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async getLatestCandle(symbolId: string, timeframe: string): Promise<CandleDocument | null> {
    return this.candleModel
      .findOne({
        symbolId: new Types.ObjectId(symbolId),
        timeframe,
      })
      .sort({ timestamp: -1 });
  }

  async upsertCandle(candleData: Partial<Candle>): Promise<CandleDocument> {
    const { symbolId, timeframe, timestamp, ...updateData } = candleData;

    return this.candleModel.findOneAndUpdate(
      {
        symbolId,
        timeframe,
        timestamp,
      },
      {
        $set: updateData,
      },
      {
        upsert: true,
        new: true,
      },
    );
  }

  async deleteOldCandles(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return this.candleModel.deleteMany({
      timestamp: { $lt: cutoffDate },
    });
  }
}

