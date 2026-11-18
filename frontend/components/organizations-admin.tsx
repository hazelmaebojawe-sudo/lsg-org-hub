'use client';

import { useState, useEffect } from 'react';
import { OfficersPanel } from '@/components/officers-panel';
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
import {
  createOrganization,
  deactivateOrganization,
  listAllOrganizations,
  updateOrganization,
  type Organization,
} from '@/lib/organizations';
import { validateOrgForm } from '@/lib/org-validation';

const textareaClass =
  'min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

/** LSG Admin: create, edit, deactivate, reactivate organizations and manage their officers. */
export function OrganizationsAdmin() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [officersOpenId, setOfficersOpenId] = useState<string | null>(null);

  // Reload the list after a change
  async function load() {
    try {
      setOrgs(await listAllOrganizations());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  // First load: state is set inside promise callbacks
  useEffect(() => {
    listAllOrganizations()
      .then(setOrgs)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateOrgForm(name, description);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    setSuccess(null);
    setCreating(true);
    try {
      await createOrganization({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setName('');
      setDescription('');
      setSuccess('Organization created.');
      await load();
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(org: Organization) {
    setEditingId(org.id);
    setEditName(org.name);
    setEditDescription(org.description ?? '');
    setEditError(null);
    setSuccess(null);
  }

  async function saveEdit(org: Organization) {
    const problem = validateOrgForm(editName, editDescription);
    if (problem) {
      setEditError(problem);
      return;
    }
    setBusyId(org.id);
    setEditError(null);
    try {
      await updateOrganization(org.id, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setEditingId(null);
      setSuccess('Organization updated.');
      await load();
    } catch (err) {
      setEditError(errMsg(err));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(org: Organization) {
    setBusyId(org.id);
    setSuccess(null);
    setError(null);
    try {
      if (org.isActive) {
        await deactivateOrganization(org.id);
        setSuccess(`"${org.name}" was deactivated.`);
      } else {
        await updateOrganization(org.id, { isActive: true });
        setSuccess(`"${org.name}" was reactivated.`);
      }
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId(null);
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
          <CardTitle>Add an organization</CardTitle>
          <CardDescription>It will appear for every student in your college.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Junior Philippine Computer Society"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-description">Description (optional)</Label>
              <textarea
                id="org-description"
                className={textareaClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" disabled={creating}>
              {creating ? 'Saving...' : 'Add organization'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your college&apos;s organizations</CardTitle>
          <CardDescription>Edit, deactivate, or reactivate organizations, and assign their officers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading organizations...</p>}
          {!loading && orgs.length === 0 && (
            <p className="text-sm text-muted-foreground">No organizations yet.</p>
          )}

          {orgs.map((org) => (
            <div key={org.id} className="rounded-lg border p-4">
              {editingId === org.id ? (
                <div className="space-y-3">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <textarea
                    className={textareaClass}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    maxLength={500}
                  />
                  {editError && <p className="text-sm text-destructive">{editError}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(org)} disabled={busyId === org.id}>
                      {busyId === org.id ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{org.name}</h3>
                        {org.type === 'LSG' && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            LSG
                          </span>
                        )}
                        {!org.isActive && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            Deactivated
                          </span>
                        )}
                      </div>
                      {org.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{org.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {org.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setOfficersOpenId(officersOpenId === org.id ? null : org.id)
                          }
                        >
                          {officersOpenId === org.id ? 'Hide officers' : 'Officers'}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => startEdit(org)}>
                        Edit
                      </Button>
                      {org.type !== 'LSG' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActive(org)}
                          disabled={busyId === org.id}
                        >
                          {busyId === org.id
                            ? 'Please wait...'
                            : org.isActive
                              ? 'Deactivate'
                              : 'Reactivate'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {officersOpenId === org.id && <OfficersPanel orgId={org.id} />}
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
