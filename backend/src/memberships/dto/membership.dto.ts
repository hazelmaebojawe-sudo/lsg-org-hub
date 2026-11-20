import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';

// Keep these patterns identical in the frontend (lib/memberships.ts)
const NAME = /^[\p{L}0-9 .,'&()\-\/]{3,100}$/u;
const NOTE = /^[^<>]{0,500}$/;
const DESCRIPTION = /^[^<>]{0,300}$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ApplyDto {
  @IsUUID('all', { message: 'Choose an organization' })
  organizationId!: string;
}

export class UploadFileDto {
  @IsUUID('all', { message: 'Choose which requirement this file is for' })
  requirementId!: string;
}

export class ReviewDto {
  @IsIn(['VERIFIED', 'REJECTED'])
  decision!: 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @Transform(trim)
  @Matches(NOTE, { message: 'Remarks must be 500 characters or fewer, without < or >' })
  remarks?: string;
}

export class RequirementDto {
  @Transform(trim)
  @Matches(NAME, { message: "Name must be 3-100 characters: letters, numbers and . , ' & ( ) - /" })
  name!: string;

  @IsOptional()
  @Transform(trim)
  @Matches(DESCRIPTION, { message: 'Description must be 300 characters or fewer, without < or >' })
  description?: string;
}