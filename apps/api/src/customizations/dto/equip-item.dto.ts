import { IsString, IsOptional, IsIn } from 'class-validator';
import { ItemType } from '@weekly-arcade/shared';

export class EquipItemDto {
  @IsString()
  gameId: string;

  @IsString()
  @IsIn(['ship', 'trail', 'bullet', 'hud', 'class'])
  itemType: ItemType;

  @IsString()
  @IsOptional()
  itemId: string | null; // null to unequip
}
