import { api } from './api';

export type Organization = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  type: 'LSG' | 'ORG';
  isActive?: boolean; // only sent to the LSG Admin's management list
};

type OrgInput = { name?: string; description?: string; isActive?: boolean };

// Everyone: active organizations of my college (cached by the backend)
export const listOrganizations = () => api<Organization[]>('/organizations');

// LSG Admin: all organizations, including deactivated ones
export const listAllOrganizations = () => api<Organization[]>('/organizations/manage');

export const createOrganization = (data: { name: string; description?: string }) =>
  api<Organization>('/organizations', { method: 'POST', body: JSON.stringify(data) });

export const updateOrganization = (id: string, data: OrgInput) =>
  api<Organization>(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deactivateOrganization = (id: string) =>
  api<{ message: string }>(`/organizations/${id}`, { method: 'DELETE' });
