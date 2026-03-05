import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { ArApType } from '../../generated/prisma';

const PROVIDER_TYPES = ['LOGTT', 'DHL', 'FEDEX', 'UPS', 'CUSTOM'] as const;
export type ProviderTypeValue = (typeof PROVIDER_TYPES)[number];

export class CreateLogisticsProviderDto {
  @IsString()
  @IsOptional()
  @MaxLength(32)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsIn(PROVIDER_TYPES)
  @IsOptional()
  type?: ProviderTypeValue = 'CUSTOM';

  @IsString()
  @IsOptional()
  appToken?: string;

  @IsString()
  @IsOptional()
  appKey?: string;

  @IsString()
  @IsOptional()
  webhookSecret?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class UpsertProviderCredentialDto {
  @IsString()
  @IsOptional()
  appToken?: string;

  @IsString()
  @IsOptional()
  appKey?: string;

  @IsString()
  @IsOptional()
  webhookSecret?: string;
}

export class UpsertFeeCodeMappingDto {
  @IsString()
  @IsNotEmpty()
  externalFeeCode: string;

  @IsString()
  @IsNotEmpty()
  internalFeeCode: string;

  @IsEnum(ArApType)
  @IsOptional()
  defaultArApType?: ArApType = ArApType.AP;
}
