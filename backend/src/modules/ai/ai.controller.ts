import { Controller, Post, Get, Body, Query, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { GenerateReportDto } from './dto/ai.dto';

@ApiTags('ai')
@Controller('ai')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('report')
  @ApiOperation({ summary: 'Generate AI analysis report' })
  async generateReport(@Request() req, @Body() dto: GenerateReportDto) {
    const userId = req.user?._id?.toString();
    return this.aiService.generateReport(
      dto.symbolId,
      dto.timeframe,
      dto.reportType,
      userId,
      dto.investmentPeriod,
    );
  }

  @Get('report/latest')
  @ApiOperation({ summary: 'Get latest AI report for a symbol' })
  @ApiQuery({ name: 'symbolId', required: true })
  @ApiQuery({ name: 'timeframe', required: false, enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] })
  @ApiQuery({ name: 'investmentPeriod', required: false, enum: ['swing', 'medium', 'long'] })
  async getLatestReport(
    @Request() req,
    @Query('symbolId') symbolId: string,
    @Query('timeframe') timeframe?: string,
    @Query('investmentPeriod') investmentPeriod: string = 'swing',
  ) {
    if (!timeframe) {
      const timeframeMap: Record<string, string> = {
        'swing': '1d',
        'medium': '1d',
        'long': '1w',
      };
      timeframe = timeframeMap[investmentPeriod] || '1d';
    }
    return this.aiService.getLatestReport(symbolId, timeframe, req.user?._id?.toString());
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get user AI reports history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserReports(@Request() req, @Query('limit') limit: number = 20) {
    return this.aiService.getUserReports(req.user?._id?.toString(), limit);
  }

  @Get('reports/history/:symbolId')
  @ApiOperation({ summary: 'Get AI analysis history for a symbol' })
  async getSymbolHistory(
    @Request() req,
    @Param('symbolId') symbolId: string,
    @Query('limit') limit: number = 10,
  ) {
    return this.aiService.getSymbolHistory(symbolId, req.user?._id?.toString(), limit);
  }

  @Get('reports/stats/:symbolId')
  @ApiOperation({ summary: 'Get backtesting stats for a symbol' })
  async getBacktestingStats(
    @Request() req,
    @Param('symbolId') symbolId: string,
  ) {
    return this.aiService.getBacktestingStats(symbolId, req.user?._id?.toString());
  }

  @Get('stats/platform')
  @ApiOperation({ summary: 'Get platform-wide AI statistics' })
  async getPlatformStats() {
    return this.aiService.getPlatformStats();
  }

  @Get('stats/me')
  @ApiOperation({ summary: 'Get my AI statistics (all symbols combined)' })
  async getMyStats(@Request() req) {
    return this.aiService.getMyStats(req.user?._id?.toString());
  }
}


