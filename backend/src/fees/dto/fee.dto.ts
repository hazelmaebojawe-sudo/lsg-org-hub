import { Transform } from 'class-transformer';
import { IsIn, IsUUID, Matches } from 'class-validator';

// Keep these patterns identical in the frontend (lib/fees.ts)
const FEE_NAME = /^[\p{L}0-9 .,'&()\-\/]{3,100}$/u;
const AMOUNT = /^\d{1,6}(\.\d{1,2})?$/; // pesos, e.g. 150 or 150.50
const SCHOOL_YEAR = /^\d{4}-\d{4}$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** "150.50" pesos -> 15050 centavos (exact, no floating point). */
export function toCentavos(amount: string): number {
  const [whole, fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export class CreateFeeDto {
  @IsUUID('all', { message: 'Choose an organization' })
  organizationId!: string;

  @Transform(trim)
  @Matches(FEE_NAME, {
    message: "Name must be 3-100 characters: letters, numbers and . , ' & ( ) - /",
  })
  name!: string;

  @Transform(trim)
  @Matches(AMOUNT, { message: 'Amount must look like 150 or 150.50' })
  amount!: string;

  @IsIn(['1st Semester', '2nd Semester', 'Summer'], { message: 'Choose a semester' })
  semester!: string;

  @Transform(trim)
  @Matches(SCHOOL_YEAR, { message: 'School year must look like 2025-2026' })
  schoolYear!: string;
}