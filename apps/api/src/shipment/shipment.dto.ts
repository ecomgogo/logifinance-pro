import { IsString, IsOptional, IsEnum, IsDecimal } from 'class-validator';

export class CreateShipmentDto {
  @IsString()
  @IsOptional()
  internalNo?: string;

  @IsString()
  @IsOptional()
  referenceNo?: string;

  @IsEnum(['COMMERCIAL_EXPRESS', 'POSTAL_SMALL_PARCEL', 'DEDICATED_LINE'])
  type: 'COMMERCIAL_EXPRESS' | 'POSTAL_SMALL_PARCEL' | 'DEDICATED_LINE';

  @IsString()
  @IsOptional()
  mblNumber?: string;

  @IsString()
  @IsOptional()
  shippingMethodCode?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,4' })
  receivableAmount?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,4' })
  payableAmount?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class UpdateShipmentFinanceDto {
  @IsString()
  @IsOptional()
  currency?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,4' })
  receivableAmount?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,4' })
  payableAmount?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class UpdateShipmentDto {
  @IsEnum(['COMMERCIAL_EXPRESS', 'POSTAL_SMALL_PARCEL', 'DEDICATED_LINE'])
  @IsOptional()
  type?: 'COMMERCIAL_EXPRESS' | 'POSTAL_SMALL_PARCEL' | 'DEDICATED_LINE';

  @IsString()
  @IsOptional()
  mblNumber?: string;

  @IsString()
  @IsOptional()
  shippingMethodCode?: string;
}