'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import * as psgc from '@/lib/psgc';
import type { Place } from '@/lib/psgc';
import { useMe } from '@/lib/use-me';
import { onboardingSchema, type OnboardingValues } from '@/lib/validation';

type College = { id: string; code: string; name: string };

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { me, loading } = useMe();

  const [colleges, setColleges] = useState<College[]>([]);
  const [regions, setRegions] = useState<Place[]>([]);
  const [provinces, setProvinces] = useState<Place[]>([]);
  const [cities, setCities] = useState<Place[]>([]);
  const [barangays, setBarangays] = useState<Place[]>([]);
  const [noProvince, setNoProvince] = useState(false);
  const [addrLoading, setAddrLoading] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const turnstile = useRef<TurnstileInstance>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      collegeId: '',
      studentNo: '',
      contactNo: '',
      regionCode: '',
      regionName: '',
      provinceCode: '',
      provinceName: '',
      cityCode: '',
      cityName: '',
      barangayCode: '',
      barangayName: '',
    },
  });

  // Only students without a college belong on this page
  useEffect(() => {
    if (loading) return;
    if (!me) router.replace('/');
    else if (me.role !== 'STUDENT' || me.collegeId) router.replace('/dashboard');
  }, [me, loading, router]);

  useEffect(() => {
    if (!me) return;
    api<College[]>('/colleges')
      .then(setColleges)
      .catch(() => setError('Could not load the college list. Please refresh.'));
    psgc
      .getRegions()
      .then(setRegions)
      .catch(() => setError('Could not load address data. Please refresh.'));
  }, [me]);

  const find = (list: Place[], code: string) => list.find((p) => p.code === code);

  async function onRegion(code: string) {
    setValue('regionCode', code, { shouldValidate: true });
    setValue('regionName', find(regions, code)?.name ?? '');
    for (const f of ['provinceCode', 'provinceName', 'cityCode', 'cityName', 'barangayCode', 'barangayName'] as const) {
      setValue(f, '');
    }
    setProvinces([]);
    setCities([]);
    setBarangays([]);
    setNoProvince(false);
    if (!code) return;

    setAddrLoading(true);
    try {
      const p = await psgc.getProvinces(code);
      if (p.length) {
        setProvinces(p);
      } else {
        setNoProvince(true); // e.g. NCR has no provinces
        setCities(await psgc.getCitiesByRegion(code));
      }
    } catch {
      setError('Could not load address data. Please try again.');
    } finally {
      setAddrLoading(false);
    }
  }

  async function onProvince(code: string) {
    setValue('provinceCode', code);
    setValue('provinceName', find(provinces, code)?.name ?? '');
    for (const f of ['cityCode', 'cityName', 'barangayCode', 'barangayName'] as const) {
      setValue(f, '');
    }
    setCities([]);
    setBarangays([]);
    if (!code) return;

    setAddrLoading(true);
    try {
      setCities(await psgc.getCitiesByProvince(code));
    } catch {
      setError('Could not load address data. Please try again.');
    } finally {
      setAddrLoading(false);
    }
  }

  async function onCity(code: string) {
    setValue('cityCode', code, { shouldValidate: true });
    setValue('cityName', find(cities, code)?.name ?? '');
    setValue('barangayCode', '');
    setValue('barangayName', '');
    setBarangays([]);
    if (!code) return;

    setAddrLoading(true);
    try {
      setBarangays(await psgc.getBarangays(code));
    } catch {
      setError('Could not load address data. Please try again.');
    } finally {
      setAddrLoading(false);
    }
  }

  function onBarangay(code: string) {
    setValue('barangayCode', code, { shouldValidate: true });
    setValue('barangayName', find(barangays, code)?.name ?? '');
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!token) {
      setError('Please complete the CAPTCHA first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { studentNo, provinceCode, provinceName, ...rest } = values;
      await api('/profile', {
        method: 'POST',
        body: JSON.stringify({
          ...rest,
          ...(studentNo ? { studentNo } : {}),
          ...(provinceCode ? { provinceCode, provinceName } : {}),
          captchaToken: token,
        }),
      });
      setSuccess(true);
      setTimeout(() => router.replace('/dashboard'), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      turnstile.current?.reset(); // CAPTCHA tokens are single-use
      setToken(null);
    } finally {
      setSubmitting(false);
    }
  });

  if (loading || !me) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </main>
    );
  }

  const siteKey = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY;

  return (
    <main className="flex min-h-screen items-start justify-center bg-muted/40 p-4 sm:items-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Complete your registration</CardTitle>
          <CardDescription>
            Welcome, {me.fullName}. Choose your college and tell us where you live. You can&apos;t
            change your college later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="College" htmlFor="collegeId" error={errors.collegeId?.message}>
                <select id="collegeId" className={selectClass} {...register('collegeId')}>
                  <option value="">Select your college</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Student number (optional)" htmlFor="studentNo" error={errors.studentNo?.message}>
                <Input id="studentNo" placeholder="e.g. 2023-00123" {...register('studentNo')} />
              </Field>

              <Field label="Mobile number" htmlFor="contactNo" error={errors.contactNo?.message}>
                <Input id="contactNo" inputMode="tel" placeholder="09123456789" {...register('contactNo')} />
              </Field>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-medium">Address</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Region" htmlFor="region" error={errors.regionCode?.message}>
                  <select
                    id="region"
                    className={selectClass}
                    value={watch('regionCode')}
                    onChange={(e) => onRegion(e.target.value)}
                  >
                    <option value="">Select region</option>
                    {regions.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>

                {!noProvince && (
                  <Field label="Province" htmlFor="province">
                    <select
                      id="province"
                      className={selectClass}
                      value={watch('provinceCode')}
                      disabled={!provinces.length}
                      onChange={(e) => onProvince(e.target.value)}
                    >
                      <option value="">Select province</option>
                      {provinces.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="City / Municipality" htmlFor="city" error={errors.cityCode?.message}>
                  <select
                    id="city"
                    className={selectClass}
                    value={watch('cityCode')}
                    disabled={!cities.length}
                    onChange={(e) => onCity(e.target.value)}
                  >
                    <option value="">Select city or municipality</option>
                    {cities.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Barangay" htmlFor="barangay" error={errors.barangayCode?.message}>
                  <select
                    id="barangay"
                    className={selectClass}
                    value={watch('barangayCode')}
                    disabled={!barangays.length}
                    onChange={(e) => onBarangay(e.target.value)}
                  >
                    <option value="">Select barangay</option>
                    {barangays.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {addrLoading && <p className="text-xs text-muted-foreground">Loading address options...</p>}
            </div>

            {siteKey ? (
              <Turnstile
                ref={turnstile}
                siteKey={siteKey}
                onSuccess={setToken}
                onExpire={() => setToken(null)}
                onError={() => setToken(null)}
              />
            ) : (
              <p className="text-sm text-destructive">
                CAPTCHA is not configured (NEXT_PUBLIC_CAPTCHA_SITE_KEY is missing).
              </p>
            )}

            {error && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            {success && (
              <p role="status" className="rounded-md border border-green-600/40 bg-green-600/10 p-3 text-sm text-green-700">
                Registration complete! Taking you to your dashboard...
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting || success}>
              {submitting ? 'Saving...' : 'Complete registration'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
