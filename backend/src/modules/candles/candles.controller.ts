import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CandlesService } from './candles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('candles')
@Controller('symbols/:symbolId/candles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CandlesController {
  constructor(private candlesService: CandlesService) {}

  @Get()
  @ApiOperation({ summary: 'Get candles for a symbol' })
  @ApiQuery({ name: 'timeframe', required: false, enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getCandles(
    @Param('symbolId') symbolId: string,
    @Query('timeframe') timeframe: string = '1d',
    @Query('limit') limit: number = 200,
  ) {
    return this.candlesService.findBySymbol(symbolId, timeframe, limit);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest candle for a symbol' })
  @ApiQuery({ name: 'timeframe', required: false })
  async getLatestCandle(
    @Param('symbolId') symbolId: string,
    @Query('timeframe') timeframe: string = '5m',
  ) {
    return this.candlesService.getLatestCandle(symbolId, timeframe);
  }
}













