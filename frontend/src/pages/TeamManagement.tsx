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
          <tr className="border-b">
            <th className="text-left py-2 font-medium text-gray-700">Resource</th>
            {actions.map((action) => (
              <th key={action} className="text-center py-2 font-medium text-gray-700 capitalize">
                {action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={resource} className="border-b">
              <td className="py-2 font-medium text-gray-700 capitalize">{resource}</td>
              {actions.map((action) => (
                <td key={action} className="text-center py-2">
                  <input
                    type="checkbox"
                    checked={permissions[resource]?.[action] ?? false}
                    onChange={(e) => handleChange(resource, action, e.target.checked)}
                    disabled={disabled}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Invite Team Member</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="colleague@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'member')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="member">Member</option>
                <option value="admin">Administrator</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                {role === 'admin'
                  ? 'Administrators have full access and can manage team members.'
                  : 'Members can view databases and manage entries, but cannot modify structure.'}
              </p>
            </div>

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
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Customize permissions</span>
              </label>
            </div>

            {showCustomPermissions && (
              <div className="border rounded-md p-4 bg-gray-50">
                <PermissionsEditor permissions={permissions} onChange={setPermissions} />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Send Invitation
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Edit Member</h2>
          <p className="text-gray-600 mb-4">
            {member.user_email}
            {member.user_first_name && ` (${member.user_first_name} ${member.user_last_name || ''})`}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'member')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="member">Member</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

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
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Customize permissions</span>
              </label>
            </div>

            {showCustomPermissions && (
              <div className="border rounded-md p-4 bg-gray-50">
                <PermissionsEditor permissions={permissions} onChange={setPermissions} />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function TeamManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Membership | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['members'],
    queryFn: listMembers,
  });

  const inviteMutation = useMutation({
    mutationFn: inviteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setShowInviteModal(false);
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
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Failed to load team members. Please try again.
          </div>
        </div>
      </div>
    );
  }

  const members = data?.members || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Invite Member
          </button>
        </div>

        {inviteMutation.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {(inviteMutation.error as Error).message || 'Failed to invite member'}
          </div>
        )}

        {updateMutation.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {(updateMutation.error as Error).message || 'Failed to update member'}
          </div>
        )}

        {removeMutation.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {(removeMutation.error as Error).message || 'Failed to remove member'}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {member.user_first_name || member.user_last_name
                          ? `${member.user_first_name || ''} ${member.user_last_name || ''}`.trim()
                          : member.user_email}
                      </div>
                      <div className="text-sm text-gray-500">{member.user_email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        member.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {member.role === 'admin' ? 'Administrator' : 'Member'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        member.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : member.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {member.user_id !== user?.id && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingMember(member)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemove(member.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                          disabled={removeMutation.isPending}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {member.user_id === user?.id && (
                      <span className="text-sm text-gray-400">You</span>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
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
