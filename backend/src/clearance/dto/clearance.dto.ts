import { IsIn, IsUUID, Matches } from 'class-validator';

export const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];
export const SCHOOL_YEAR = /^\d{4}-\d{4}$/;

export class IssueClearanceDto {
  @IsUUID('all', { message: 'Choose a student' })
  userId!: string;

  @IsIn(SEMESTERS, { message: 'Choose a semester' })
  semester!: string;

  @Matches(SCHOOL_YEAR, { message: 'School year must look like 2025-2026' })
  schoolYear!: string;
}