import { api } from './api';

// Same rule as the backend (officer.dto.ts)
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Officer = { id: string; fullName: string; email: string };

export const listOfficers = (orgId: string) =>
  api<Officer[]>(`/organizations/${orgId}/officers`);

export const assignOfficer = (orgId: string, email: string) =>
  api<Officer>(`/organizations/${orgId}/officers`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const removeOfficer = (orgId: string, userId: string) =>
  api<{ message: string }>(`/organizations/${orgId}/officers/${userId}`, {
    method: 'DELETE',
  });
