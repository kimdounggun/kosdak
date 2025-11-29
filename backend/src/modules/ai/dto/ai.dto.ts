import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateReportDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  symbolId: string;

  @ApiProperty({ 
    example: '1d', 
    required: false,
    enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'],
    description: '시간 프레임 (선택사항, 미지정시 투자기간에 따라 자동 선택: swing=4h, medium=1d, long=1w)'
  })
  @IsOptional()
  @IsString()
  timeframe?: string;

  @ApiProperty({ 
    example: 'comprehensive',
    enum: ['trend', 'volatility', 'volume', 'support_resistance', 'comprehensive'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['trend', 'volatility', 'volume', 'support_resistance', 'comprehensive'])
  reportType?: string = 'comprehensive';

  @ApiProperty({ 
    example: 'swing',
    enum: ['swing', 'medium', 'long'],
    required: false,
    description: '투자 기간: swing (3~7일), medium (2~4주), long (1~3개월)'
  })
  @IsOptional()
  @IsEnum(['swing', 'medium', 'long'])
  investmentPeriod?: string = 'swing';
}



