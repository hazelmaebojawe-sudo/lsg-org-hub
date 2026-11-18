import { api } from './api';

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  organization: { id: string; name: string; type: 'LSG' | 'ORG' };
  author: { fullName: string };
};

export type PostableOrg = { id: string; name: string; type: 'LSG' | 'ORG' };

// Same rules as the backend (announcement.dto.ts)
export const TITLE = /^[\p{L}0-9 .,:;!?'"&()\-\/#@+%]{3,120}$/u;
export const BODY = /^[^<>]{1,2000}$/;

/** Returns an error message, or null when valid. */
export function validateAnnouncement(title: string, body: string): string | null {
  if (!TITLE.test(title.trim())) {
    return 'Title must be 3-120 characters (letters, numbers and common punctuation).';
  }
  if (!BODY.test(body.trim())) {
    return 'Message must be 1-2000 characters and cannot contain < or >.';
  }
  return null;
}

export const listAnnouncements = () => api<AnnouncementItem[]>('/announcements');

export const listPostableOrgs = () => api<PostableOrg[]>('/announcements/my-organizations');

export const createAnnouncement = (data: {
  organizationId: string;
  title: string;
  body: string;
}) => api<AnnouncementItem>('/announcements', { method: 'POST', body: JSON.stringify(data) });

export const updateAnnouncement = (id: string, data: { title: string; body: string }) =>
  api<AnnouncementItem>(`/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteAnnouncement = (id: string) =>
  api<{ message: string }>(`/announcements/${id}`, { method: 'DELETE' });