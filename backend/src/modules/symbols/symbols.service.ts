import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
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

  async updateLogoUrl(symbolId: string, logoUrl: string | null) {
    return this.symbolModel.findByIdAndUpdate(
      symbolId,
      { $set: { logoUrl: logoUrl || null } },
      { new: true },
    );
  }

  async updateAllLogos() {
    const symbols = await this.symbolModel.find({ isActive: true });
    const results = [];

    for (const symbol of symbols) {
      try {
        // 잘못된 URL 패턴 체크 (C200x200, img1.daumcdn.net/thumb, finance/company, finance/logo 포함)
        const hasInvalidUrl = symbol.logoUrl && (
          symbol.logoUrl.includes('C200x200') || 
          symbol.logoUrl.includes('img1.daumcdn.net/thumb') ||
          symbol.logoUrl.includes('finance/company') ||
          symbol.logoUrl.includes('finance/logo') // 다음 DAUM 로고 URL도 404가 많아서 제거
        );

        // 잘못된 URL이 있으면 null로 설정 (프론트엔드에서 fallback 아이콘 사용)
        if (hasInvalidUrl) {
          await this.updateLogoUrl(symbol._id.toString(), null);
          results.push({ 
            symbol: symbol.name, 
            code: symbol.code, 
            logoUrl: null, 
            status: 'removed_invalid' 
          });
        } else {
          results.push({ 
            symbol: symbol.name, 
            code: symbol.code, 
            logoUrl: symbol.logoUrl || null, 
            status: 'skipped' 
          });
        }

        // API 호출 제한을 피하기 위해 약간의 지연
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        results.push({ symbol: symbol.name, code: symbol.code, status: 'error', error: error.message });
      }
    }

    return {
      total: symbols.length,
      results,
    };
  }
}


