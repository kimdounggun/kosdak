import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Symbol, SymbolDocument } from '../schemas/symbol.schema';
import { AiService } from '../modules/ai/ai.service';

@Injectable()
export class AutoAiAnalysisWorker {
  private readonly logger = new Logger(AutoAiAnalysisWorker.name);

  constructor(
    @InjectModel(Symbol.name) private symbolModel: Model<SymbolDocument>,
    private aiService: AiService,
  ) {}

  // 매일 오전 9시, 오후 3시 (하루 2번)
  @Cron('0 9,15 * * *')
  async generateDailyAnalysis() {
    this.logger.log('🤖 자동 AI 분석 시작...');

    try {
      // yahooTicker가 있는 모든 활성 종목 가져오기
      const symbols = await this.symbolModel.find({ 
        isActive: true,
        yahooTicker: { $exists: true, $ne: null }
      });
      
      this.logger.log(`📊 분석 대상: ${symbols.length}개 종목`);
      
      // 🎯 특정 사용자 ID (김동건 계정)
      const AUTO_USER_ID = '69243880642a931de4044f8b';
      
      let successCount = 0;
      let failCount = 0;

      for (const symbol of symbols) {
        try {
          // 각 종목에 대해 AI 분석 생성
          await this.aiService.generateReport(
            symbol._id.toString(),
            '5m',
            'comprehensive',
            AUTO_USER_ID, // ← 당신 계정으로 생성
            'swing'
          );

          successCount++;
          this.logger.debug(`✅ ${symbol.name} 분석 완료`);

          // API 제한 방지 (1초 대기)
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          failCount++;
          this.logger.error(`❌ ${symbol.name} 분석 실패: ${error.message}`);
        }
      }

      this.logger.log(`✅ 자동 AI 분석 완료: 성공 ${successCount}개, 실패 ${failCount}개`);
      this.logger.log(`💰 예상 비용: $${(successCount * 0.0015).toFixed(4)}`);

    } catch (error) {
      this.logger.error('❌ 자동 AI 분석 오류:', error);
    }
  }

  // 수동 실행용 (테스트)
  async runManually() {
    this.logger.log('🔧 수동 실행 시작...');
    await this.generateDailyAnalysis();
  }
}

