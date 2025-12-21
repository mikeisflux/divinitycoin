// app/admin/admins/[id]/EditAdminForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  mfaEnabled: boolean;
}

const ROLES = [
  { value: 'VIEWER', label: 'Viewer' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

export function EditAdminForm({
  admin,
  canEdit,
  currentAdminId,
}: {
  admin: AdminUser;
  canEdit: boolean;
  currentAdminId: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    name: admin.name || '',
    email: admin.email,
    role: admin.role,
    newPassword: '',
    confirmPassword: '',
  });

  const isSelf = admin.id === currentAdminId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.newPassword && formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/admins/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          ...(formData.newPassword && { password: formData.newPassword }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update admin');
      }

      setSuccess('Admin updated successfully');
      setFormData({ ...formData, newPassword: '', confirmPassword: '' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update admin');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isSelf) {
      alert('You cannot delete your own account');
      return;
    }

    if (!confirm('Are you sure you want to delete this admin? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/admins/${admin.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete admin');
      }

      router.push('/admin/admins');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete admin');
      setIsLoading(false);
    }
  };

  const handleUnlock = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/admins/${admin.id}/unlock`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unlock account');
      }

      setSuccess('Account unlocked successfully');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-neutral-200 p-6 space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {!canEdit && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
          You cannot edit Super Admin accounts unless you are a Super Admin.
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-2">
          Full Name
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          disabled={!canEdit}
          required
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
          Email Address
        </label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          disabled={!canEdit}
          required
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-neutral-700 mb-2">
          Role
        </label>
        <select
          id="role"
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          disabled={!canEdit || isSelf}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
        >
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        {isSelf && (
          <p className="text-xs text-neutral-500 mt-1">You cannot change your own role</p>
        )}
      </div>

      <hr className="border-neutral-200" />

      <div>
        <h4 className="text-sm font-medium text-neutral-700 mb-4">Change Password</h4>
        <div className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-neutral-700 mb-2">
              New Password
            </label>
            <input
              type="password"
              id="newPassword"
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              disabled={!canEdit}
              minLength={8}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
              placeholder="Leave blank to keep current"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              disabled={!canEdit}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
              placeholder="Confirm new password"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isLoading || !canEdit}
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>

        <button
          type="button"
          onClick={handleUnlock}
          disabled={isLoading}
          className="px-4 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 transition"
        >
          Unlock Account
        </button>

        {canEdit && !isSelf && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
