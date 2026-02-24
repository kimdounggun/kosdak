import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SymbolsService } from './symbols.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AddUserSymbolDto } from './dto/symbols.dto';

@ApiTags('symbols')
@Controller('symbols')
export class SymbolsController {
  constructor(private symbolsService: SymbolsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all symbols' })
  @ApiQuery({ name: 'market', required: false, enum: ['KOSPI', 'KOSDAQ'] })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(
    @Query('market') market?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.symbolsService.findAll(market, isActive);
  }

  @Get('user/my-symbols')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user watchlist symbols' })
  async getUserSymbols(@Request() req) {
    if (!req.user) return [];
    return this.symbolsService.getUserSymbols(req.user._id.toString());
  }

  @Post('user/symbols')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add symbol to user watchlist' })
  async addUserSymbol(@Request() req, @Body() dto: AddUserSymbolDto) {
    if (!req.user) throw new UnauthorizedException('로그인이 필요합니다');
    return this.symbolsService.addUserSymbol(req.user._id.toString(), dto.symbolId);
  }

  @Delete('user/symbols/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove symbol from user watchlist' })
  async removeUserSymbol(@Request() req, @Param('id') id: string) {
    if (!req.user) throw new UnauthorizedException('로그인이 필요합니다');
    return this.symbolsService.removeUserSymbol(req.user._id.toString(), id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get symbol by ID' })
  async findOne(@Param('id') id: string) {
    return this.symbolsService.findById(id);
  }

  @Post('update-logos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update logos for all symbols' })
  async updateLogos() {
    return this.symbolsService.updateAllLogos();
  }
}

