import { IsString, IsEnum, IsNumber, IsUUID, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateChargeDto {
  @IsUUID()
  shipmentId: string;

  // 🌟 亮點：我們直接讓前端傳名稱，後端負責找人或建檔
  @IsString()
  partnerName: string; 

  @IsEnum(['AR', 'AP'])
  arApType: 'AR' | 'AP';

  @IsString()
  feeCode: string;

  @IsString()
  currency: string;

  @IsNumber()
  @Type(() => Number)
  amount: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  exchangeRate?: number = 1;
}