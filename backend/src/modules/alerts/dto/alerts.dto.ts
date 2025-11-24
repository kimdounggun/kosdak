import { IsString, IsBoolean, IsArray, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AlertCondition } from '../../../schemas/alert.schema';
import { Types } from 'mongoose';

export class CreateAlertDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  symbolId: string | Types.ObjectId;

  @ApiProperty({ example: 'RSI 과매도 알림' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'RSI가 30 이하일 때 알림', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ 
    example: [
      { type: 'indicator', operator: '<', indicator: 'rsi', value: 30 }
    ]
  })
  @IsArray()
  conditionJson: AlertCondition[];

  @ApiProperty({ example: 'all', enum: ['all', 'any'], required: false })
  @IsOptional()
  @IsEnum(['all', 'any'])
  conditionLogic?: string = 'all';

  @ApiProperty({ example: 60, required: false })
  @IsOptional()
  @IsNumber()
  cooldownMinutes?: number = 60;

  @ApiProperty({ example: ['sms'], required: false })
  @IsOptional()
  @IsArray()
  notificationChannels?: string[] = ['sms'];
}

export class UpdateAlertDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  conditionJson?: AlertCondition[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(['all', 'any'])
  conditionLogic?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  cooldownMinutes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  notificationChannels?: string[];
}

