import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IndicatorsService } from './indicators.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('indicators')
@Controller('symbols/:symbolId/indicators')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
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
























