'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { API_URL } from '@/lib/api';
import { useMe } from '@/lib/use-me';

export default function SignInPage() {
  const router = useRouter();
  const { me, loading } = useMe();

  // Already signed in? Go where this user belongs.
  useEffect(() => {
    if (!me) return;
    router.replace(me.role === 'STUDENT' && !me.collegeId ? '/onboarding' : '/dashboard');
  }, [me, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">LSG Org Hub</CardTitle>
          <CardDescription>
            Memberships, announcements, and fees for your college and its organizations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Checking your session...</p>
          ) : me ? (
            <p className="text-center text-sm text-muted-foreground">Redirecting...</p>
          ) : (
            <>
              <a
                href={`${API_URL}/auth/google`}
                className={`${buttonVariants({ size: 'lg' })} w-full`}
              >
                Sign in with Google
              </a>
              <p className="text-center text-xs text-muted-foreground">
                Use your school Google account.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
