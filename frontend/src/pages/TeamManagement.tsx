import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMembers,
  inviteMember,
  updateMember,
  removeMember,
  Membership,
  ResourcePermissions,
  Permission,
  DEFAULT_PERMISSIONS,
} from '../api/users';
import { useAuthStore } from '../store/authStore';
import { Button, Modal, Input, Select } from '../components/ui';
import UpgradeBanner, { extractPlanLimitError } from '../components/UpgradeBanner';
import type { PlanLimitError } from '../types/billing';

function PermissionsEditor({
  permissions,
  onChange,
  disabled,
}: {
  permissions: ResourcePermissions;
  onChange: (permissions: ResourcePermissions) => void;
  disabled?: boolean;
}) {
  const resources = ['database', 'field', 'entry', 'user'] as const;
  const actions = ['create', 'read', 'update', 'delete'] as const;

  const handleChange = (resource: keyof ResourcePermissions, action: keyof Permission, value: boolean) => {
    onChange({
      ...permissions,
      [resource]: {
        ...permissions[resource],
        [action]: value,
      },
    });
  };

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-500">
            <th className="text-left py-2 font-medium text-dark-100">Resource</th>
            {actions.map((action) => (
              <th key={action} className="text-center py-2 font-medium text-dark-100 capitalize">
                {action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={resource} className="border-b border-dark-600">
              <td className="py-2 font-medium text-white capitalize">{resource}</td>
              {actions.map((action) => (
                <td key={action} className="text-center py-2">
                  <input
                    type="checkbox"
                    checked={permissions[resource]?.[action] ?? false}
                    onChange={(e) => handleChange(resource, action, e.target.checked)}
                    disabled={disabled}
                    className="rounded border-dark-400 bg-dark-600 text-accent focus:ring-accent disabled:opacity-50"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InviteModal({
  onClose,
  onInvite,
}: {
  onClose: () => void;
  onInvite: (data: { email: string; role: 'admin' | 'member'; permissions: ResourcePermissions }) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [permissions, setPermissions] = useState<ResourcePermissions>(DEFAULT_PERMISSIONS.member);
  const [showCustomPermissions, setShowCustomPermissions] = useState(false);

  const handleRoleChange = (newRole: 'admin' | 'member') => {
    setRole(newRole);
    if (!showCustomPermissions) {
      setPermissions(DEFAULT_PERMISSIONS[newRole]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    onInvite({ email: email.trim(), role, permissions });
  };

  return (
    <Modal isOpen onClose={onClose} title="Invite Team Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@example.com"
          required
        />

        <Select
          label="Role"
          value={role}
          onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'member')}
          options={[
            { value: 'member', label: 'Member' },
            { value: 'admin', label: 'Administrator' },
          ]}
        />
        <p className="text-sm text-dark-100 -mt-2">
          {role === 'admin'
            ? 'Administrators have full access and can manage team members.'
            : 'Members can view databases and manage entries, but cannot modify structure.'}
        </p>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCustomPermissions}
              onChange={(e) => {
                setShowCustomPermissions(e.target.checked);
                if (!e.target.checked) {
                  setPermissions(DEFAULT_PERMISSIONS[role]);
                }
              }}
              className="rounded border-dark-400 bg-dark-600 text-accent focus:ring-accent"
            />
            <span className="text-sm text-dark-100">Customize permissions</span>
          </label>
        </div>

        {showCustomPermissions && (
          <div className="border border-dark-500 rounded-md p-4 bg-dark-800">
            <PermissionsEditor permissions={permissions} onChange={setPermissions} />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Send Invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditMemberModal({
  member,
  onClose,
  onSave,
}: {
  member: Membership;
  onClose: () => void;
  onSave: (data: { role: 'admin' | 'member'; permissions: ResourcePermissions; status: 'active' | 'inactive' }) => void;
}) {
  const [role, setRole] = useState(member.role);
  const [permissions, setPermissions] = useState<ResourcePermissions>(member.permissions);
  const [status, setStatus] = useState(member.status as 'active' | 'inactive');
  const [showCustomPermissions, setShowCustomPermissions] = useState(true);

  const handleRoleChange = (newRole: 'admin' | 'member') => {
    setRole(newRole);
    if (!showCustomPermissions) {
      setPermissions(DEFAULT_PERMISSIONS[newRole]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ role, permissions, status });
  };

  return (
    <Modal isOpen onClose={onClose} title="Edit Member">
      <p className="text-dark-100 mb-4">
        {member.user_email}
        {member.user_first_name && ` (${member.user_first_name} ${member.user_last_name || ''})`}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Role"
          value={role}
          onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'member')}
          options={[
            { value: 'member', label: 'Member' },
            { value: 'admin', label: 'Administrator' },
          ]}
        />

        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCustomPermissions}
              onChange={(e) => {
                setShowCustomPermissions(e.target.checked);
                if (!e.target.checked) {
                  setPermissions(DEFAULT_PERMISSIONS[role]);
                }
              }}
              className="rounded border-dark-400 bg-dark-600 text-accent focus:ring-accent"
            />
            <span className="text-sm text-dark-100">Customize permissions</span>
          </label>
        </div>

        {showCustomPermissions && (
          <div className="border border-dark-500 rounded-md p-4 bg-dark-800">
            <PermissionsEditor permissions={permissions} onChange={setPermissions} />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function TeamManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Membership | null>(null);
  const [planLimitError, setPlanLimitError] = useState<PlanLimitError | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['members'],
    queryFn: listMembers,
  });

  const inviteMutation = useMutation({
    mutationFn: inviteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setShowInviteModal(false);
      setPlanLimitError(null);
    },
    onError: (err) => {
      const limitErr = extractPlanLimitError(err);
      if (limitErr) {
        setPlanLimitError(limitErr);
        setShowInviteModal(false);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateMember>[1] }) =>
      updateMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setEditingMember(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  const handleInvite = (data: { email: string; role: 'admin' | 'member'; permissions: ResourcePermissions }) => {
    inviteMutation.mutate(data);
  };

  const handleUpdate = (data: { role: 'admin' | 'member'; permissions: ResourcePermissions; status: 'active' | 'inactive' }) => {
    if (editingMember) {
      updateMutation.mutate({ id: editingMember.id, data });
    }
  };

  const handleRemove = (memberId: string) => {
    if (window.confirm('Are you sure you want to remove this team member?')) {
      removeMutation.mutate(memberId);
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-dark-600 rounded w-1/4 mb-6"></div>
            <div className="h-64 bg-dark-600 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-400">
            Failed to load team members. Please try again.
          </div>
        </div>
      </div>
    );
  }

  const members = data?.members || [];

  return (
    <div>
      <div className="max-w-4xl mx-auto">
        <UpgradeBanner error={planLimitError} onDismiss={() => setPlanLimitError(null)} />

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Team Management</h1>
          <Button onClick={() => setShowInviteModal(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Invite Member
          </Button>
        </div>

        {inviteMutation.error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm mb-4">
            {(inviteMutation.error as Error).message || 'Failed to invite member'}
          </div>
        )}

        {updateMutation.error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm mb-4">
            {(updateMutation.error as Error).message || 'Failed to update member'}
          </div>
        )}

        {removeMutation.error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm mb-4">
            {(removeMutation.error as Error).message || 'Failed to remove member'}
          </div>
        )}

        <div className="bg-dark-700 rounded-lg border border-dark-500 overflow-hidden">
          <table className="min-w-full divide-y divide-dark-400">
            <thead className="bg-dark-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-100 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-100 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-100 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-dark-100 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-dark-700 divide-y divide-dark-500">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-dark-600 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-white">
                        {member.user_first_name || member.user_last_name
                          ? `${member.user_first_name || ''} ${member.user_last_name || ''}`.trim()
                          : member.user_email}
                      </div>
                      <div className="text-sm text-dark-100">{member.user_email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        member.role === 'admin'
                          ? 'bg-purple-900/50 text-purple-400'
                          : 'bg-dark-500 text-dark-100'
                      }`}
                    >
                      {member.role === 'admin' ? 'Administrator' : 'Member'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        member.status === 'active'
                          ? 'bg-green-900/50 text-green-400'
                          : member.status === 'pending'
                          ? 'bg-yellow-900/50 text-yellow-400'
                          : 'bg-dark-500 text-dark-200'
                      }`}
                    >
                      {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {member.user_id !== user?.id && (
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setEditingMember(member)}
                          className="text-accent hover:text-accent-light text-sm font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemove(member.id)}
                          className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                          disabled={removeMutation.isPending}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {member.user_id === user?.id && (
                      <span className="text-sm text-dark-200">You</span>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-dark-100">
                    No team members yet. Invite your first team member!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showInviteModal && (
          <InviteModal
            onClose={() => setShowInviteModal(false)}
            onInvite={handleInvite}
          />
        )}

        {editingMember && (
          <EditMemberModal
            member={editingMember}
            onClose={() => setEditingMember(null)}
            onSave={handleUpdate}
          />
        )}
      </div>
    </div>
  );
}
