import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { NotificationChannel, NotificationChannelDocument } from '../../schemas/notification-channel.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(NotificationChannel.name)
    private notificationChannelModel: Model<NotificationChannelDocument>,
    private configService: ConfigService,
  ) {}

  async create(userId: string, channelData: Partial<NotificationChannel>) {
    const channel = new this.notificationChannelModel({
      ...channelData,
      userId: new Types.ObjectId(userId),
      verified: false,
    });
    return channel.save();
  }

  async findUserChannels(userId: string, type?: string) {
    const filter: any = { userId: new Types.ObjectId(userId) };
    if (type) {
      filter.type = type;
    }
    return this.notificationChannelModel.find(filter).sort({ createdAt: -1 });
  }

  async findById(channelId: string): Promise<NotificationChannelDocument> {
    const channel = await this.notificationChannelModel.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Notification channel not found');
    }
    return channel;
  }

  async update(
    userId: string,
    channelId: string,
    updateData: Partial<NotificationChannel>,
  ): Promise<NotificationChannelDocument> {
    const channel = await this.notificationChannelModel.findOneAndUpdate(
      { _id: new Types.ObjectId(channelId), userId: new Types.ObjectId(userId) },
      updateData,
      { new: true },
    );

    if (!channel) {
      throw new NotFoundException('Notification channel not found');
    }

    return channel;
  }

  async delete(userId: string, channelId: string): Promise<void> {
    const result = await this.notificationChannelModel.findOneAndDelete({
      _id: new Types.ObjectId(channelId),
      userId: new Types.ObjectId(userId),
    });

    if (!result) {
      throw new NotFoundException('Notification channel not found');
    }
  }

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const apiKey = this.configService.get<string>('SMS_API_KEY');
      const apiSecret = this.configService.get<string>('SMS_API_SECRET');
      const fromNumber = this.configService.get<string>('SMS_FROM_NUMBER');

      if (!apiKey || !apiSecret) {
        console.warn('SMS API not configured');
        return false;
      }

      // Example: CoolSMS/Solapi API call
      // Replace with actual SMS API endpoint
      const response = await axios.post(
        'https://api.solapi.com/messages/v4/send',
        {
          message: {
            to: phoneNumber,
            from: fromNumber,
            text: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.status === 200;
    } catch (error) {
      console.error('SMS send error:', error);
      return false;
    }
  }

  async sendTelegram(chatId: string, message: string): Promise<boolean> {
    try {
      const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

      if (!botToken) {
        console.warn('Telegram bot not configured');
        return false;
      }

      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        },
      );

      return response.status === 200;
    } catch (error) {
      console.error('Telegram send error:', error);
      return false;
    }
  }

  async sendNotification(
    userId: string,
    message: string,
    channels: string[] = ['sms'],
  ): Promise<void> {
    const userChannels = await this.findUserChannels(userId);

    for (const channelType of channels) {
      const channel = userChannels.find(
        c => c.type === channelType && c.enabled && c.verified,
      );

      if (!channel) {
        continue;
      }

      switch (channel.type) {
        case 'sms':
          await this.sendSMS(channel.value, message);
          break;
        case 'telegram':
          await this.sendTelegram(channel.value, message);
          break;
        case 'email':
          // TODO: Implement email sending
          break;
        case 'webhook':
          // TODO: Implement webhook call
          break;
      }
    }
  }
}



