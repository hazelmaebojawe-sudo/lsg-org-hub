'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { listOrganizations, type Organization } from '@/lib/organizations';

/** Read-only list for students and officers: organizations of their own college. */
export function OrganizationsList() {
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listOrganizations()
      .then(setOrgs)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Could not load organizations.'),
      );
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizations</CardTitle>
        <CardDescription>The student government and organizations of your college.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {!orgs && !error && <p className="text-sm text-muted-foreground">Loading organizations...</p>}
        {orgs && orgs.length === 0 && (
          <p className="text-sm text-muted-foreground">No organizations yet.</p>
        )}
        {orgs?.map((org) => (
          <div key={org.id} className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{org.name}</h3>
              {org.type === 'LSG' && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  LSG
                </span>
              )}
            </div>
            {org.description && (
              <p className="mt-1 text-sm text-muted-foreground">{org.description}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
