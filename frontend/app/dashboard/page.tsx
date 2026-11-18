'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnnouncementsSection } from '@/components/announcements-section';
import { OrganizationsAdmin } from '@/components/organizations-admin';
import { OrganizationsList } from '@/components/organizations-list';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useMe } from '@/lib/use-me';

const ROLE_LABEL = {
  STUDENT: 'Student Member',
  OFFICER: 'Org Officer',
  LSG_ADMIN: 'LSG Admin',
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

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hello, {me.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {ROLE_LABEL[me.role]}
            {me.college ? ` \u2022 ${me.college.code}` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={logout}>
          Sign out
        </Button>
      </header>

      <AnnouncementsSection role={me.role} />

      {me.role === 'LSG_ADMIN' ? <OrganizationsAdmin /> : <OrganizationsList />}
    </main>
  );
}