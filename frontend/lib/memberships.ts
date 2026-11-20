import { api } from './api';

export type Status = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'WITHDRAWN';

export type Requirement = { id: string; name: string; description: string | null };

export type MyMembership = {
  id: string;
  status: Status;
  remarks: string | null;
  appliedAt: string;
  organization: { id: string; name: string; type: 'LSG' | 'ORG' };
  files: { id: string; requirementId: string }[];
};

export type OrgApplication = {
  id: string;
  status: Status;
  remarks: string | null;
  appliedAt: string;
  user: { id: string; fullName: string; email: string };
  files: { id: string; requirement: { id: string; name: string } }[];
};

// Same rule as the backend (membership.dto.ts)
export const REQ_NAME = /^[\p{L}0-9 .,'&()\-\/]{3,100}$/u;
export const MAX_FILE = 5 * 1024 * 1024;
export const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const listRequirements = (orgId: string) =>
  api<Requirement[]>(`/organizations/${orgId}/requirements`);
export const addRequirement = (orgId: string, data: { name: string; description?: string }) =>
  api<Requirement>(`/organizations/${orgId}/requirements`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const removeRequirement = (orgId: string, id: string) =>
  api<{ message: string }>(`/organizations/${orgId}/requirements/${id}`, { method: 'DELETE' });

export const applyToOrg = (organizationId: string) =>
  api<{ id: string }>('/memberships', { method: 'POST', body: JSON.stringify({ organizationId }) });
export const listMine = () => api<MyMembership[]>('/memberships/mine');
export const withdrawApplication = (id: string) =>
  api<{ message: string }>(`/memberships/${id}`, { method: 'DELETE' });

export function uploadRequirementFile(membershipId: string, requirementId: string, file: File) {
  const form = new FormData();
  form.append('requirementId', requirementId);
  form.append('file', file);
  return api<{ id: string }>(`/memberships/${membershipId}/files`, { method: 'POST', body: form });
}

export const listApplications = (orgId: string) =>
  api<OrgApplication[]>(`/organizations/${orgId}/memberships`);
export const reviewApplication = (id: string, decision: 'VERIFIED' | 'REJECTED', remarks?: string) =>
  api<{ id: string }>(`/memberships/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, ...(remarks ? { remarks } : {}) }),
  });
export const getFileUrl = (fileId: string) =>
  api<{ url: string }>(`/memberships/files/${fileId}/url`);