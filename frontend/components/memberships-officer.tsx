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
import { Input } from '@/components/ui/input';
import { listPostableOrgs, type PostableOrg } from '@/lib/announcements';
import {
  REQ_NAME,
  addRequirement,
  getFileUrl,
  listApplications,
  listRequirements,
  removeRequirement,
  reviewApplication,
  type OrgApplication,
  type Requirement,
} from '@/lib/memberships';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** Officer / LSG Admin: define requirements and verify or reject applications. */
export function MembershipsOfficer() {
  const [orgs, setOrgs] = useState<PostableOrg[]>([]);
  const [orgId, setOrgId] = useState('');
  const [reqs, setReqs] = useState<Requirement[]>([]);
  const [apps, setApps] = useState<OrgApplication[]>([]);
  const [reqName, setReqName] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const activeOrg = orgId || (orgs.length === 1 ? orgs[0].id : '');

  async function refresh(id: string) {
    const [r, a] = await Promise.all([listRequirements(id), listApplications(id)]);
    setReqs(r);
    setApps(a);
  }

  useEffect(() => {
    listPostableOrgs()
      .then(setOrgs)
      .catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    if (!activeOrg) return;
    Promise.all([listRequirements(activeOrg), listApplications(activeOrg)])
      .then(([r, a]) => {
        setReqs(r);
        setApps(a);
      })
      .catch((e) => setError(errMsg(e)));
  }, [activeOrg]);

  async function run(key: string, action: () => Promise<unknown>, okMessage: string) {
    setBusy(key);
    setError(null);
    setSuccess(null);
    try {
      await action();
      setSuccess(okMessage);
      await refresh(activeOrg);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  function handleAddRequirement(e: React.FormEvent) {
    e.preventDefault();
    if (!REQ_NAME.test(reqName.trim())) {
      setError("Requirement name must be 3-100 characters: letters, numbers and . , ' & ( ) - /");
      return;
    }
    void run(
      'add-req',
      () =>
        addRequirement(activeOrg, {
          name: reqName.trim(),
          ...(reqDescription.trim() ? { description: reqDescription.trim() } : {}),
        }),
      'Requirement added.',
    ).then(() => {
      setReqName('');
      setReqDescription('');
    });
  }

  function decide(a: OrgApplication, decision: 'VERIFIED' | 'REJECTED') {
    let remarks: string | undefined;
    if (decision === 'REJECTED') {
      const reason = window.prompt('Reason for rejecting (optional):');
      if (reason === null) return;
      remarks = reason.trim() || undefined;
    }
    void run(
      a.id,
      () => reviewApplication(a.id, decision, remarks),
      decision === 'VERIFIED' ? 'Application verified.' : 'Application rejected.',
    );
  }

  async function openFile(fileId: string) {
    try {
      const { url } = await getFileUrl(fileId);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Memberships</CardTitle>
          <CardDescription>Choose an organization to set its requirements and review applications.</CardDescription>
        </CardHeader>
        <CardContent>
          <select className={selectClass} value={activeOrg} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">Choose an organization</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {activeOrg && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
              <CardDescription>Files students must upload when they apply.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {reqs.length === 0 && <p className="text-sm text-muted-foreground">No requirements yet.</p>}
              {reqs.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === r.id}
                    onClick={() => run(r.id, () => removeRequirement(activeOrg, r.id), 'Requirement removed.')}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <form onSubmit={handleAddRequirement} className="flex flex-col gap-2 sm:flex-row" noValidate>
                <Input placeholder="e.g. Certificate of registration" value={reqName} onChange={(e) => setReqName(e.target.value)} />
                <Input placeholder="Short hint (optional)" value={reqDescription} onChange={(e) => setReqDescription(e.target.value)} />
                <Button type="submit" disabled={busy === 'add-req'}>
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Applications</CardTitle>
              <CardDescription>Verify when all required files are submitted.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {apps.length === 0 && <p className="text-sm text-muted-foreground">No applications yet.</p>}
              {apps.map((a) => (
                <div key={a.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{a.user.fullName}</p>
                      <p className="text-xs text-muted-foreground">{a.user.email}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{a.status}</span>
                  </div>
                  {a.files.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {a.files.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-2">
                          <span>{f.requirement.name}</span>
                          <Button size="sm" variant="outline" onClick={() => openFile(f.id)}>
                            View file
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.remarks && <p className="text-sm text-muted-foreground">Remarks: {a.remarks}</p>}
                  {a.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy === a.id} onClick={() => decide(a, 'VERIFIED')}>
                        Verify
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => decide(a, 'REJECTED')}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}