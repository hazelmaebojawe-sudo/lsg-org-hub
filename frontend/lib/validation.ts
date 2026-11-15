import { z } from 'zod';

// Keep these patterns identical to the backend (profile.dto.ts)
export const PH_MOBILE = /^(09|\+639)\d{9}$/;
export const STUDENT_NO = /^[A-Za-z0-9-]{4,20}$/;
const PSGC_CODE = /^\d{9,10}$/;

export const onboardingSchema = z.object({
  collegeId: z.string().min(1, 'Please select a college'),
  studentNo: z
    .string()
    .regex(STUDENT_NO, 'Student number must be 4-20 letters, numbers or dashes')
    .or(z.literal('')),
  contactNo: z
    .string()
    .regex(PH_MOBILE, 'Use a number like 09123456789 or +639123456789'),
  regionCode: z.string().regex(PSGC_CODE, 'Please select a region'),
  regionName: z.string(),
  provinceCode: z.string(),
  provinceName: z.string(),
  cityCode: z.string().regex(PSGC_CODE, 'Please select a city or municipality'),
  cityName: z.string(),
  barangayCode: z.string().regex(PSGC_CODE, 'Please select a barangay'),
  barangayName: z.string(),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;
