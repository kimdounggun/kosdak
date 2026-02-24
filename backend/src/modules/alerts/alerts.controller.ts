import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Body, 
  Param, 
  Query,
  UseGuards, 
  Request,
  UnauthorizedException 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateAlertDto, UpdateAlertDto } from './dto/alerts.dto';

@ApiTags('alerts')
@Controller('alerts')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth()
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Post()
  @ApiOperation({ summary: 'Create new alert' })
  async create(@Request() req, @Body() dto: CreateAlertDto) {
    if (!req.user) throw new UnauthorizedException('로그인이 필요합니다');
    return this.alertsService.create(req.user._id.toString(), dto as any);
  }

  @Get()
  @ApiOperation({ summary: 'Get user alerts' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  async findAll(@Request() req, @Query('active') active?: boolean) {
    if (!req.user) return [];
    return this.alertsService.findUserAlerts(req.user._id.toString(), active);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get alert by ID' })
  async findOne(@Param('id') id: string) {
    return this.alertsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update alert' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    if (!req.user) throw new UnauthorizedException('로그인이 필요합니다');
    return this.alertsService.update(req.user._id.toString(), id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete alert' })
  async delete(@Request() req, @Param('id') id: string) {
    if (!req.user) throw new UnauthorizedException('로그인이 필요합니다');
    await this.alertsService.delete(req.user._id.toString(), id);
    return { message: 'Alert deleted successfully' };
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get alert trigger logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAlertLogs(
    @Param('id') id: string,
    @Query('limit') limit: number = 50,
  ) {
    return this.alertsService.getAlertLogs(id, limit);
  }

  @Get('logs/all')
  @ApiOperation({ summary: 'Get all user alert logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllLogs(@Request() req, @Query('limit') limit: number = 50) {
    if (!req.user) return [];
    return this.alertsService.getAllUserAlertLogs(req.user._id.toString(), limit);
  }
}

