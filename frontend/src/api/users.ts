import apiClient from './client';

export interface Permission {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface ResourcePermissions {
  database: Permission;
  field: Permission;
  entry: Permission;
  user: Permission;
}

export interface Membership {
  id: string;
  account_id: string;
  user_id: string;
  user_email: string;
  user_first_name: string | null;
  user_last_name: string | null;
  role: 'admin' | 'member';
  permissions: ResourcePermissions;
  status: 'pending' | 'active' | 'inactive';
  invited_by_id: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface AccountWithMembership {
  account: Account;
  membership: Membership;
}

export async function getCurrentAccount(): Promise<{ account: Account | null; membership: Membership | null }> {
  const response = await apiClient.get('/users/account');
  return response.data;
}

export async function listMembers(): Promise<{ members: Membership[]; total: number }> {
  const response = await apiClient.get('/users/account/members');
  return response.data;
}

export async function inviteMember(data: {
  email: string;
  role?: 'admin' | 'member';
  permissions?: Partial<ResourcePermissions>;
}): Promise<{ membership: Membership }> {
  const response = await apiClient.post('/users/account/members', data);
  return response.data;
}

export async function updateMember(
  memberId: string,
  data: {
    role?: 'admin' | 'member';
    permissions?: Partial<ResourcePermissions>;
    status?: 'active' | 'inactive';
  }
): Promise<{ membership: Membership }> {
  const response = await apiClient.put(`/users/account/members/${memberId}`, data);
  return response.data;
}

export async function removeMember(memberId: string): Promise<{ message: string }> {
  const response = await apiClient.delete(`/users/account/members/${memberId}`);
  return response.data;
}

export async function listAccounts(): Promise<{ accounts: AccountWithMembership[] }> {
  const response = await apiClient.get('/users/accounts');
  return response.data;
}

export async function switchAccount(accountId: string): Promise<AccountWithMembership> {
  const response = await apiClient.post(`/users/accounts/switch/${accountId}`);
  return response.data;
}

export const DEFAULT_PERMISSIONS: Record<'admin' | 'member', ResourcePermissions> = {
  admin: {
    database: { create: true, read: true, update: true, delete: true },
    field: { create: true, read: true, update: true, delete: true },
    entry: { create: true, read: true, update: true, delete: true },
    user: { create: true, read: true, update: true, delete: true },
  },
  member: {
    database: { create: false, read: true, update: false, delete: false },
    field: { create: false, read: true, update: false, delete: false },
    entry: { create: true, read: true, update: true, delete: false },
    user: { create: false, read: false, update: false, delete: false },
  },
};
