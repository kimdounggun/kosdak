import { Controller, Post, Get, Body, Query, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GenerateReportDto } from './dto/ai.dto';

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('report')
  @ApiOperation({ summary: 'Generate AI analysis report' })
  async generateReport(@Request() req, @Body() dto: GenerateReportDto) {
    return this.aiService.generateReport(
      dto.symbolId,
      dto.timeframe,
      dto.reportType,
      req.user._id.toString(),
      dto.investmentPeriod,
    );
  }

  @Get('report/latest')
  @ApiOperation({ summary: 'Get latest AI report for a symbol' })
  @ApiQuery({ name: 'symbolId', required: true })
  @ApiQuery({ name: 'timeframe', required: false })
  async getLatestReport(
    @Request() req,
    @Query('symbolId') symbolId: string,
    @Query('timeframe') timeframe: string = '5m',
  ) {
    return this.aiService.getLatestReport(symbolId, timeframe, req.user._id.toString());
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get user AI reports history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserReports(@Request() req, @Query('limit') limit: number = 20) {
    return this.aiService.getUserReports(req.user._id.toString(), limit);
  }

  @Get('reports/history/:symbolId')
  @ApiOperation({ summary: 'Get AI analysis history for a symbol' })
  async getSymbolHistory(
    @Request() req,
    @Param('symbolId') symbolId: string,
    @Query('limit') limit: number = 10,
  ) {
    return this.aiService.getSymbolHistory(symbolId, req.user._id.toString(), limit);
  }

  @Get('reports/stats/:symbolId')
  @ApiOperation({ summary: 'Get backtesting stats for a symbol' })
  async getBacktestingStats(
    @Request() req,
    @Param('symbolId') symbolId: string,
  ) {
    return this.aiService.getBacktestingStats(symbolId, req.user._id.toString());
  }
}


