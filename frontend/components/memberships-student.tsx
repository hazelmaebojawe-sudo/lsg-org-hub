'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ALLOWED_TYPES,
  MAX_FILE,
  applyToOrg,
  listMine,
  listRequirements,
  uploadRequirementFile,
  withdrawApplication,
  type MyMembership,
  type Requirement,
} from '@/lib/memberships';
import { listOrganizations, type Organization } from '@/lib/organizations';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

const STATUS_LABEL = {
  PENDING: 'Pending review',
  VERIFIED: 'Member',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
} as const;

/** Student: see the college's organizations, apply, and upload the requirements. */
export function MembershipsStudent() {
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [mine, setMine] = useState<MyMembership[]>([]);
  const [reqs, setReqs] = useState<Record<string, Requirement[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Reads everything from the API without touching state
  async function fetchAll() {
    const [o, m] = await Promise.all([listOrganizations(), listMine()]);
    const pending = m.filter((x) => x.status === 'PENDING');
    const entries = await Promise.all(
      pending.map(async (x) => [x.organization.id, await listRequirements(x.organization.id)] as const),
    );
    return { o, m, reqs: Object.fromEntries(entries) };
  }

  function applyData(data: Awaited<ReturnType<typeof fetchAll>>) {
    setOrgs(data.o);
    setMine(data.m);
    setReqs(data.reqs);
  }

  async function loadAll() {
    applyData(await fetchAll());
  }

  useEffect(() => {
    fetchAll()
      .then(applyData)
      .catch((e) => setError(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `mine` is sorted newest first, so the first match is the latest application
  const latest = (orgId: string) => mine.find((m) => m.organization.id === orgId);

  async function run(key: string, action: () => Promise<unknown>, okMessage: string) {
    setBusy(key);
    setError(null);
    setSuccess(null);
    try {
      await action();
      setSuccess(okMessage);
      await loadAll();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  function onPick(m: MyMembership, requirementId: string, file: File | undefined) {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PDF, JPG or PNG files are allowed.');
      return;
    }
    if (file.size > MAX_FILE) {
      setError('The file must be 5 MB or smaller.');
      return;
    }
    void run(`${m.id}:${requirementId}`, () => uploadRequirementFile(m.id, requirementId, file), 'File uploaded.');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizations</CardTitle>
        <CardDescription>Join your college&apos;s organizations and upload the requirements.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-md border border-green-600/40 bg-green-600/10 p-3 text-sm text-green-700">
            {success}
          </p>
        )}
        {!orgs && !error && <p className="text-sm text-muted-foreground">Loading organizations...</p>}
        {orgs && orgs.length === 0 && <p className="text-sm text-muted-foreground">No organizations yet.</p>}

        {orgs?.map((org) => {
          const m = latest(org.id);
          const status = m?.status;
          const canApply = !m || status === 'REJECTED' || status === 'WITHDRAWN';
          const required = reqs[org.id] ?? [];

          return (
            <div key={org.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{org.name}</h3>
                    {org.type === 'LSG' && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">LSG</span>
                    )}
                  </div>
                  {org.description && <p className="mt-1 text-sm text-muted-foreground">{org.description}</p>}
                </div>
                {status && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{STATUS_LABEL[status]}</span>
                )}
              </div>

              {status === 'REJECTED' && m?.remarks && (
                <p className="text-sm text-destructive">Reason: {m.remarks}</p>
              )}

              {canApply && (
                <Button
                  size="sm"
                  disabled={busy === org.id}
                  onClick={() =>
                    run(org.id, () => applyToOrg(org.id), 'Application submitted. Upload the requirements below.')
                  }
                >
                  {busy === org.id ? 'Applying...' : status ? 'Apply again' : 'Apply to join'}
                </Button>
              )}

              {m && status === 'PENDING' && (
                <div className="space-y-3 rounded-md bg-muted/40 p-3">
                  <p className="text-sm font-medium">Requirements</p>
                  {required.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      This organization has no requirements. Your application is waiting for review.
                    </p>
                  )}
                  {required.map((r) => {
                    const done = m.files.some((f) => f.requirementId === r.id);
                    return (
                      <div key={r.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm">
                            {r.name} {done && <span className="text-green-700">(uploaded)</span>}
                          </p>
                          {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                        </div>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="text-sm"
                          disabled={busy === `${m.id}:${r.id}`}
                          onChange={(e) => {
                            onPick(m, r.id, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </div>
                    );
                  })}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === m.id}
                    onClick={() => {
                      if (window.confirm('Withdraw this application?')) {
                        void run(m.id, () => withdrawApplication(m.id), 'Application withdrawn.');
                      }
                    }}
                  >
                    {busy === m.id ? 'Please wait...' : 'Withdraw application'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}