import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IndicatorsService } from './indicators.service';

@ApiTags('indicators')
@Controller('symbols/:symbolId/indicators')
export class IndicatorsController {
  constructor(private indicatorsService: IndicatorsService) {}

  @Get()
  @ApiOperation({ summary: 'Get indicators for a symbol' })
  @ApiQuery({ name: 'timeframe', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getIndicators(
    @Param('symbolId') symbolId: string,
    @Query('timeframe') timeframe: string = '5m',
    @Query('limit') limit: number = 200,
  ) {
    return this.indicatorsService.findBySymbol(symbolId, timeframe, limit);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest indicators for a symbol' })
  @ApiQuery({ name: 'timeframe', required: false })
  async getLatestIndicators(
    @Param('symbolId') symbolId: string,
    @Query('timeframe') timeframe: string = '5m',
  ) {
    return this.indicatorsService.getLatest(symbolId, timeframe);
  }
}





























