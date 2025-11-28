import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateNotificationChannelDto, UpdateNotificationChannelDto } from './dto/notifications.dto';

@ApiTags('notifications')
@Controller('notifications/channels')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create notification channel' })
  async create(@Request() req, @Body() dto: CreateNotificationChannelDto) {
    return this.notificationsService.create(req.user._id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user notification channels' })
  @ApiQuery({ name: 'type', required: false, enum: ['sms', 'telegram', 'email', 'webhook'] })
  async findAll(@Request() req, @Query('type') type?: string) {
    return this.notificationsService.findUserChannels(req.user._id, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification channel by ID' })
  async findOne(@Param('id') id: string) {
    return this.notificationsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update notification channel' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationChannelDto,
  ) {
    return this.notificationsService.update(req.user._id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification channel' })
  async delete(@Request() req, @Param('id') id: string) {
    await this.notificationsService.delete(req.user._id, id);
    return { message: 'Notification channel deleted successfully' };
  }
}












