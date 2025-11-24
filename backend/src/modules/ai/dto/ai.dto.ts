import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateReportDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  symbolId: string;

  @ApiProperty({ example: '5m', required: false })
  @IsOptional()
  @IsString()
  timeframe?: string = '5m';

  @ApiProperty({ 
    example: 'comprehensive',
    enum: ['trend', 'volatility', 'volume', 'support_resistance', 'comprehensive'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['trend', 'volatility', 'volume', 'support_resistance', 'comprehensive'])
  reportType?: string = 'comprehensive';
}

