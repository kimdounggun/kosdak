import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiService } from '../modules/ai/ai.service';
import { SymbolsService } from '../modules/symbols/symbols.service';

@Injectable()
export class AiReportWorker {
  private readonly logger = new Logger(AiReportWorker.name);

  constructor(
    private aiService: AiService,
    private symbolsService: SymbolsService,
  ) {}

  // 비활성화: 사용자가 버튼 클릭할 때만 AI 분석
  // @Cron('0 9,15 * * *')
  async generateDailyReports() {
    this.logger.log('Starting daily AI report generation...');

    try {
      const activeSymbols = await this.symbolsService.getActiveSymbols();
      this.logger.log(`Generating reports for ${activeSymbols.length} symbols`);

      for (const symbol of activeSymbols) {
        try {
          await this.aiService.generateReport(
            symbol._id.toString(),
            '5m',
            'comprehensive',
          );

          this.logger.debug(`Generated report for ${symbol.name}`);

          // Add delay to avoid rate limiting
          await this.sleep(2000);
        } catch (error) {
          this.logger.error(
            `Error generating report for ${symbol.code}: ${error.message}`,
          );
        }
      }

      this.logger.log('Daily AI report generation completed');
    } catch (error) {
      this.logger.error(`AI report generation error: ${error.message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Manual trigger method
  async generateNow() {
    await this.generateDailyReports();
  }
}

