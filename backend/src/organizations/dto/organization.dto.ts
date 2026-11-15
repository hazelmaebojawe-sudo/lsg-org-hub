import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Keep this pattern identical in the frontend form
const ORG_NAME = /^[\p{L}0-9 .,'&()\-]{3,100}$/u;
const NAME_MESSAGE =
  "Name must be 3-100 characters: letters, numbers and . , ' & ( ) -";

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateOrganizationDto {
  @Transform(trim)
  @Matches(ORG_NAME, { message: NAME_MESSAGE })
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @Transform(trim)
  @Matches(ORG_NAME, { message: NAME_MESSAGE })
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
