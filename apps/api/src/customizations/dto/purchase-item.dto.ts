import { IsString } from 'class-validator';

export class PurchaseItemDto {
  @IsString()
  itemId: string;
}
