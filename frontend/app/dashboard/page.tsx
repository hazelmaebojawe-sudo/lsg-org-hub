'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api } from '@/lib/api';
import { useMe } from '@/lib/use-me';

const ROLE_INFO = {
  STUDENT: {
    label: 'Student Member',
    items: ['Join organizations in your college', 'Pay LSG fees and org dues', 'Download clearance receipts'],
  },
  OFFICER: {
    label: 'Org Officer',
    items: ['Manage your organization\u2019s members', 'Verify submitted requirements', 'View collected dues'],
  },
  LSG_ADMIN: {
    label: 'LSG Admin',
    items: ['Manage organizations in your college', 'Collect LSG dues', 'Issue college clearances'],
  },
} as const;

export default function DashboardPage() {
  const router = useRouter();
  const { me, loading } = useMe();

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace('/');
    else if (me.role === 'STUDENT' && !me.collegeId) router.replace('/onboarding');
  }, [me, loading, router]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  if (loading || !me) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </main>
    );
  }

  const info = ROLE_INFO[me.role];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hello, {me.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {info.label}
            {me.college ? ` \u2022 ${me.college.code}` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={logout}>
          Sign out
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{info.label} dashboard</CardTitle>
          <CardDescription>These features are coming next.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {info.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
