import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

// RegEx rules (the same patterns must also be used in the frontend form)
const PSGC_CODE = /^\d{9,10}$/;
const PLACE_NAME = /^[\p{L}0-9 .,'()\-\/]{2,100}$/u;
const PH_MOBILE = /^(09|\+639)\d{9}$/;
const STUDENT_NO = /^[A-Za-z0-9-]{4,20}$/;

export class ProfileDetailsDto {
  @IsOptional()
  @Matches(STUDENT_NO, {
    message: 'Student number must be 4-20 letters, numbers or dashes',
  })
  studentNo?: string;

  @Matches(PH_MOBILE, {
    message: 'Contact number must look like 09123456789 or +639123456789',
  })
  contactNo!: string;

  @Matches(PSGC_CODE, { message: 'Invalid region code' })
  regionCode!: string;
  @Matches(PLACE_NAME, { message: 'Invalid region name' })
  regionName!: string;

  // Optional: some regions (e.g. NCR) have no provinces
  @IsOptional()
  @Matches(PSGC_CODE, { message: 'Invalid province code' })
  provinceCode?: string;
  @IsOptional()
  @Matches(PLACE_NAME, { message: 'Invalid province name' })
  provinceName?: string;

  @Matches(PSGC_CODE, { message: 'Invalid city/municipality code' })
  cityCode!: string;
  @Matches(PLACE_NAME, { message: 'Invalid city/municipality name' })
  cityName!: string;

  @Matches(PSGC_CODE, { message: 'Invalid barangay code' })
  barangayCode!: string;
  @Matches(PLACE_NAME, { message: 'Invalid barangay name' })
  barangayName!: string;
}

export class CreateProfileDto extends ProfileDetailsDto {
  @IsUUID('all', { message: 'Please select a college' })
  collegeId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Please complete the CAPTCHA' })
  captchaToken!: string;
}
