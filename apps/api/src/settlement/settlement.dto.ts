import { IsUUID, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSettlementDto {
  @IsUUID()
  chargeId: string; // 要核銷哪一筆費用

  @IsNumber()
  @Type(() => Number)
  paidAmount: number; // 實際收/付了多少錢

  @IsDateString()
  paymentDate: string; // 收/付款日期 (YYYY-MM-DD)
}