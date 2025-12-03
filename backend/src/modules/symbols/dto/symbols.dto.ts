import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddUserSymbolDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  symbolId: string;
}

export class UpdateUserSymbolDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  alertEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  order?: number;
}



















