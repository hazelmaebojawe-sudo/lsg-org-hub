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
import { Label } from '@/components/ui/label';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  listPostableOrgs,
  updateAnnouncement,
  validateAnnouncement,
  type AnnouncementItem,
  type PostableOrg,
} from '@/lib/announcements';

type Role = 'STUDENT' | 'OFFICER' | 'LSG_ADMIN';

const textareaClass =
  'min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

// All times are shown in Philippine time
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  });

/** Announcement feed for everyone; admins and officers can also post, edit and delete. */
export function AnnouncementsSection({ role }: { role: Role }) {
  const canPost = role === 'LSG_ADMIN' || role === 'OFFICER';

  const [items, setItems] = useState<AnnouncementItem[] | null>(null);
  const [orgs, setOrgs] = useState<PostableOrg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [orgId, setOrgId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    try {
      setItems(await listAnnouncements());
    } catch (e) {
      setError(errMsg(e));
    }
  }

  useEffect(() => {
    listAnnouncements()
      .then(setItems)
      .catch((e) => setError(errMsg(e)));
    if (canPost) {
      listPostableOrgs()
        .then(setOrgs)
        .catch((e) => setError(errMsg(e)));
    }
  }, [canPost]);

  // An officer with a single organization doesn't need to choose
  const selectedOrg = orgId || (orgs.length === 1 ? orgs[0].id : '');

  const canManage = (item: AnnouncementItem) =>
    role === 'LSG_ADMIN' || orgs.some((o) => o.id === item.organization.id);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrg) {
      setFormError('Please choose an organization.');
      return;
    }
    const problem = validateAnnouncement(title, body);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    setSuccess(null);
    setPosting(true);
    try {
      await createAnnouncement({
        organizationId: selectedOrg,
        title: title.trim(),
        body: body.trim(),
      });
      setTitle('');
      setBody('');
      setSuccess('Announcement posted.');
      await reload();
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setPosting(false);
    }
  }

  function startEdit(item: AnnouncementItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditBody(item.body);
    setEditError(null);
    setSuccess(null);
  }

  async function saveEdit(item: AnnouncementItem) {
    const problem = validateAnnouncement(editTitle, editBody);
    if (problem) {
      setEditError(problem);
      return;
    }
    setBusyId(item.id);
    setEditError(null);
    try {
      await updateAnnouncement(item.id, { title: editTitle.trim(), body: editBody.trim() });
      setEditingId(null);
      setSuccess('Announcement updated.');
      await reload();
    } catch (err) {
      setEditError(errMsg(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: AnnouncementItem) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setBusyId(item.id);
    setSuccess(null);
    setError(null);
    try {
      await deleteAnnouncement(item.id);
      setSuccess('Announcement deleted.');
      await reload();
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

      {canPost && (
        <Card>
          <CardHeader>
            <CardTitle>Post an announcement</CardTitle>
            <CardDescription>Everyone in your college will see it.</CardDescription>
          </CardHeader>
          <CardContent>
            {orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                There is no organization you can post for yet.
              </p>
            ) : (
              <form onSubmit={handlePost} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="ann-org">Organization</Label>
                  <select
                    id="ann-org"
                    className={selectClass}
                    value={selectedOrg}
                    onChange={(e) => setOrgId(e.target.value)}
                  >
                    <option value="">Choose an organization</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ann-title">Title</Label>
                  <Input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ann-body">Message</Label>
                  <textarea
                    id="ann-body"
                    className={textareaClass}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={2000}
                  />
                </div>
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <Button type="submit" disabled={posting}>
                  {posting ? 'Posting...' : 'Post announcement'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
          <CardDescription>The latest news from your college&apos;s organizations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!items && !error && <p className="text-sm text-muted-foreground">Loading announcements...</p>}
          {items && items.length === 0 && (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          )}

          {items?.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              {editingId === item.id ? (
                <div className="space-y-3">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  <textarea
                    className={textareaClass}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    maxLength={2000}
                  />
                  {editError && <p className="text-sm text-destructive">{editError}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(item)} disabled={busyId === item.id}>
                      {busyId === item.id ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {item.organization.name}
                        {item.organization.type === 'LSG' ? ' (LSG)' : ''} &bull; {item.author.fullName}{' '}
                        &bull; {formatDate(item.createdAt)}
                        {Math.abs(new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime()) > 1000
                          ? ' (edited)'
                          : ''}
                      </p>
                    </div>
                    {canManage(item) && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === item.id}
                          onClick={() => handleDelete(item)}
                        >
                          {busyId === item.id ? 'Please wait...' : 'Delete'}
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}