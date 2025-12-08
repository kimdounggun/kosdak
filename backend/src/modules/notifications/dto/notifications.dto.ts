import { IsString, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationChannelDto {
  @ApiProperty({ example: 'sms', enum: ['sms', 'telegram', 'email', 'webhook'] })
  @IsEnum(['sms', 'telegram', 'email', 'webhook'])
  type: string;

  @ApiProperty({ example: '01012345678' })
  @IsString()
  value: string;

  @ApiProperty({ example: '내 휴대폰', required: false })
  @IsOptional()
  @IsString()
  name?: string;
}

export class UpdateNotificationChannelDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;
}
























