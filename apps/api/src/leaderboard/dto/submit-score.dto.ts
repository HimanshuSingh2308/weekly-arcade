import { IsString, IsNumber, IsOptional, Min, Max, IsObject, ValidateBy } from 'class-validator';

// Custom validator to enforce metadata size limit (prevent storage abuse)
function MaxMetadataSize(maxBytes: number) {
  return ValidateBy({
    name: 'maxMetadataSize',
    validator: {
      validate(value: unknown): boolean {
        if (value === undefined || value === null) return true;
        try {
          return JSON.stringify(value).length <= maxBytes;
        } catch {
          return false;
        }
      },
      defaultMessage(): string {
        return `metadata must be less than ${maxBytes} bytes when serialized`;
      },
    },
  });
}

export class SubmitScoreDto {
  @IsNumber()
  @Min(0)
  score: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  guessCount?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  level?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  timeMs?: number;

  @IsString()
  @IsOptional()
  wordHash?: string;

  @IsObject()
  @IsOptional()
  @MaxMetadataSize(2048)
  metadata?: Record<string, any>;
}
