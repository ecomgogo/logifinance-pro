import {
  IsString,
  IsEnum,
  IsUUID,
  IsOptional,
  IsDecimal,
} from 'class-validator';

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

  @IsDecimal({ decimal_digits: '1,4' })
  amount: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,6' })
  exchangeRate?: string;
}