import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiReport, AiReportDocument } from '../schemas/ai-report.schema';
import { CandlesService } from '../modules/candles/candles.service';

@Injectable()
export class OutcomeTrackerWorker {
  private readonly logger = new Logger(OutcomeTrackerWorker.name);

  constructor(
    @InjectModel(AiReport.name) private aiReportModel: Model<AiReportDocument>,
    private candlesService: CandlesService,
  ) {}

  // 매일 오전 10시에 실행
  @Cron('0 10 * * *')
  async trackOutcomes() {
    this.logger.log('🔍 AI 예측 결과 추적 시작...');

    try {
      // 24시간~48시간 전에 생성된 리포트 중 아직 추적되지 않은 것들
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const untrackedReports = await this.aiReportModel.find({
        createdAt: { $gte: twoDaysAgo, $lte: yesterday },
        'actualOutcome.recordedAt': { $exists: false },
      }).limit(100);

      this.logger.log(`📊 추적할 리포트: ${untrackedReports.length}개`);

      let successCount = 0;
      let failCount = 0;

      for (const report of untrackedReports) {
        try {
          // 현재 가격 가져오기
          const candles = await this.candlesService.findBySymbol(
            report.symbolId.toString(),
            report.timeframe,
            1,
          );

          if (candles.length === 0) {
            failCount++;
            continue;
          }

          const currentPrice = candles[0].close;
          const originalPrice = report.metadata?.priceAtGeneration || 0;

          if (originalPrice === 0) {
            failCount++;
            continue;
          }

          const priceChangePercent = ((currentPrice - originalPrice) / originalPrice) * 100;

          // AI 예측이 맞았는지 판단
          const predictedAction = report.predictedAction || '관망';
          let wasCorrect = false;
          let correctnessScore = 0;

          // 예측 정확도 계산
          if (predictedAction.includes('매수')) {
            // 매수 예측: 가격이 올랐으면 정답
            if (priceChangePercent > 0) {
              wasCorrect = true;
              correctnessScore = Math.min(100, priceChangePercent * 20); // +5% = 100점
            } else {
              wasCorrect = false;
              correctnessScore = Math.max(0, 100 + priceChangePercent * 20);
            }
          } else if (predictedAction.includes('매도') || predictedAction.includes('주의')) {
            // 매도 예측: 가격이 떨어졌거나 횡보하면 정답
            if (priceChangePercent <= 0) {
              wasCorrect = true;
              correctnessScore = Math.min(100, Math.abs(priceChangePercent) * 20);
            } else {
              wasCorrect = false;
              correctnessScore = Math.max(0, 100 - priceChangePercent * 20);
            }
          } else {
            // 관망 예측: 변화가 작으면 정답
            const absChange = Math.abs(priceChangePercent);
            if (absChange < 2) {
              wasCorrect = true;
              correctnessScore = Math.max(0, 100 - absChange * 50);
            } else {
              wasCorrect = false;
              correctnessScore = Math.max(0, 50 - absChange * 10);
            }
          }

          // 결과 저장
          await this.aiReportModel.updateOne(
            { _id: report._id },
            {
              $set: {
                actualOutcome: {
                  priceAfter24h: currentPrice,
                  priceChangePercent: parseFloat(priceChangePercent.toFixed(2)),
                  recordedAt: new Date(),
                  wasCorrect,
                  correctnessScore: Math.round(correctnessScore),
                },
              },
            },
          );

          successCount++;
          this.logger.debug(
            `✅ ${report.symbolId} - ${predictedAction}: ${priceChangePercent.toFixed(2)}% (${wasCorrect ? '정답' : '오답'})`,
          );
        } catch (error) {
          failCount++;
          this.logger.error(`❌ 리포트 ${report._id} 추적 실패:`, error.message);
        }
      }

      this.logger.log(
        `✨ AI 예측 결과 추적 완료 - 성공: ${successCount}, 실패: ${failCount}`,
      );
    } catch (error) {
      this.logger.error('🚨 AI 예측 결과 추적 중 오류:', error);
    }
  }

  // 테스트용: 수동 실행
  async trackOutcomesManually() {
    await this.trackOutcomes();
  }
}

