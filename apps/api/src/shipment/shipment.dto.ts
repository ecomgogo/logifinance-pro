import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateShipmentDto {
  @IsString()
  internalNo: string;

  @IsEnum(['OCEAN', 'AIR'])
  type: 'OCEAN' | 'AIR';

  @IsString()
  @IsOptional()
  mblNumber?: string;
}