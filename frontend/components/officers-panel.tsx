'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  assignOfficer,
  EMAIL,
  listOfficers,
  removeOfficer,
  type Officer,
} from '@/lib/officers';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

/** LSG Admin: assign or remove the officers of one organization. */
export function OfficersPanel({ orgId }: { orgId: string }) {
  const [officers, setOfficers] = useState<Officer[] | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listOfficers(orgId)
      .then(setOfficers)
      .catch((e) => setError(errMsg(e)));
  }, [orgId]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const officer = await assignOfficer(orgId, value);
      setEmail('');
      setSuccess(`${officer.fullName} is now an officer.`);
      setOfficers(await listOfficers(orgId));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(officer: Officer) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await removeOfficer(orgId, officer.id);
      setSuccess(`${officer.fullName} was removed.`);
      setOfficers(await listOfficers(orgId));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-md bg-muted/40 p-4">
      <p className="text-sm font-medium">Officers</p>

      {!officers && !error && <p className="text-sm text-muted-foreground">Loading officers...</p>}
      {officers && officers.length === 0 && (
        <p className="text-sm text-muted-foreground">No officers yet.</p>
      )}
      {officers?.map((o) => (
        <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
          <span>
            {o.fullName} <span className="text-muted-foreground">({o.email})</span>
          </span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => handleRemove(o)}>
            Remove
          </Button>
        </div>
      ))}

      <form onSubmit={handleAssign} className="flex flex-col gap-2 sm:flex-row" noValidate>
        <Input
          type="email"
          placeholder="Student's email (must be registered in your college)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={busy}>
          {busy ? 'Please wait...' : 'Assign officer'}
        </Button>
      </form>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && <p role="status" className="text-sm text-green-700">{success}</p>}
    </div>
  );
}
