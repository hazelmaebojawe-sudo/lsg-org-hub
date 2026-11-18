import { Transform } from 'class-transformer';
import { Matches, MaxLength } from 'class-validator';

// Keep this pattern identical in the frontend (lib/officers.ts)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AssignOfficerDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MaxLength(254)
  @Matches(EMAIL, { message: 'Enter a valid email address' })
  email!: string;
}