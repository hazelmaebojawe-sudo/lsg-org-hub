import { Transform } from 'class-transformer';
import { IsOptional, IsUUID, Matches } from 'class-validator';

// Keep these patterns identical in the frontend (lib/announcements.ts)
const TITLE = /^[\p{L}0-9 .,:;!?'"&()\-\/#@+%]{3,120}$/u;
const BODY = /^[^<>]{1,2000}$/;

const TITLE_MESSAGE =
  'Title must be 3-120 characters (letters, numbers and common punctuation)';
const BODY_MESSAGE = 'Message must be 1-2000 characters and cannot contain < or >';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAnnouncementDto {
  @IsUUID('all', { message: 'Please choose an organization' })
  organizationId!: string;

  @Transform(trim)
  @Matches(TITLE, { message: TITLE_MESSAGE })
  title!: string;

  @Transform(trim)
  @Matches(BODY, { message: BODY_MESSAGE })
  body!: string;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @Transform(trim)
  @Matches(TITLE, { message: TITLE_MESSAGE })
  title?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(BODY, { message: BODY_MESSAGE })
  body?: string;
}