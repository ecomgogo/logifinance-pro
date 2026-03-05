import {
  IsIn,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class UpsertLogttCredentialDto {
  @IsString()
  @IsNotEmpty()
  appToken: string;

  @IsString()
  @IsNotEmpty()
  appKey: string;
}

export class LogisticsWebhookHeadersDto {
  @IsString()
  @IsIn(['hawbcode', 'weight', 'tracking', 'fee'])
  datatype: 'hawbcode' | 'weight' | 'tracking' | 'fee';

  @IsString()
  @IsNotEmpty()
  sign: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;
}
