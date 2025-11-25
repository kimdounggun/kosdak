import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Symbol, SymbolDocument } from '../../schemas/symbol.schema';
import { UserSymbol, UserSymbolDocument } from '../../schemas/user-symbol.schema';

@Injectable()
export class SymbolsService {
  constructor(
    @InjectModel(Symbol.name) private symbolModel: Model<SymbolDocument>,
    @InjectModel(UserSymbol.name) private userSymbolModel: Model<UserSymbolDocument>,
  ) {}

  async findAll(market?: string, isActive?: boolean) {
    const filter: any = {};
    if (market) filter.market = market;
    if (isActive !== undefined) filter.isActive = isActive;

    return this.symbolModel.find(filter).sort({ name: 1 });
  }

  async findById(id: string): Promise<SymbolDocument> {
    const symbol = await this.symbolModel.findById(id);
    if (!symbol) {
      throw new NotFoundException('Symbol not found');
    }
    return symbol;
  }

  async findByCode(market: string, code: string): Promise<SymbolDocument | null> {
    return this.symbolModel.findOne({ market, code });
  }

  async getUserSymbols(userId: string) {
    return this.userSymbolModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('symbolId')
      .sort({ order: 1, createdAt: 1 });
  }

  async addUserSymbol(userId: string, symbolId: string) {
    const userSymbol = new this.userSymbolModel({
      userId: new Types.ObjectId(userId),
      symbolId: new Types.ObjectId(symbolId),
      alertEnabled: true,
    });
    return userSymbol.save();
  }

  async removeUserSymbol(userId: string, userSymbolId: string) {
    const result = await this.userSymbolModel.findOneAndDelete({
      _id: new Types.ObjectId(userSymbolId),
      userId: new Types.ObjectId(userId),
    });
    
    if (!result) {
      throw new NotFoundException('User symbol not found');
    }
    
    return result;
  }

  async updateUserSymbol(userId: string, userSymbolId: string, updateData: Partial<UserSymbol>) {
    const userSymbol = await this.userSymbolModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(userSymbolId),
        userId: new Types.ObjectId(userId),
      },
      updateData,
      { new: true },
    );

    if (!userSymbol) {
      throw new NotFoundException('User symbol not found');
    }

    return userSymbol;
  }

  async getActiveSymbols() {
    return this.symbolModel.find({ isActive: true });
  }
}


