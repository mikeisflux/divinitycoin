'use client';

import { useState } from 'react';

interface Mailbox {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  autoReplyEnabled: boolean;
  autoReplySubject: string | null;
  autoReplyMessage: string | null;
  signature: string | null;
  emailCount: number;
  createdAt: string;
}

interface MailboxesClientProps {
  initialMailboxes: Mailbox[];
}

export function MailboxesClient({ initialMailboxes }: MailboxesClientProps) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>(initialMailboxes);
  const [showModal, setShowModal] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: '',
    name: '',
    isDefault: false,
    signature: '',
    autoReplyEnabled: false,
    autoReplySubject: '',
    autoReplyMessage: '',
  });

  const openCreateModal = () => {
    setEditingMailbox(null);
    setForm({
      email: '',
      name: '',
      isDefault: false,
      signature: '',
      autoReplyEnabled: false,
      autoReplySubject: '',
      autoReplyMessage: '',
    });
    setShowModal(true);
  };

  const openEditModal = (mailbox: Mailbox) => {
    setEditingMailbox(mailbox);
    setForm({
      email: mailbox.email,
      name: mailbox.name,
      isDefault: mailbox.isDefault,
      signature: mailbox.signature || '',
      autoReplyEnabled: mailbox.autoReplyEnabled,
      autoReplySubject: mailbox.autoReplySubject || '',
      autoReplyMessage: mailbox.autoReplyMessage || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (editingMailbox) {
        // Update
        const res = await fetch(`/api/admin/mailboxes/${editingMailbox.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();

        if (data.mailbox) {
          setMailboxes((prev) =>
            prev.map((m) =>
              m.id === editingMailbox.id ? { ...m, ...data.mailbox } : m
            )
          );
        }
      } else {
        // Create
        const res = await fetch('/api/admin/mailboxes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();

        if (data.mailbox) {
          setMailboxes((prev) => [{ ...data.mailbox, emailCount: 0 }, ...prev]);
        }
      }

      setShowModal(false);
    } catch (error) {
      console.error('Failed to save mailbox:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (mailbox: Mailbox) => {
    if (mailbox.emailCount > 0) {
      alert('Cannot delete mailbox with emails. Delete or move emails first.');
      return;
    }

    if (!confirm(`Delete mailbox "${mailbox.name}" (${mailbox.email})?`)) {
      return;
    }

    try {
      await fetch(`/api/admin/mailboxes/${mailbox.id}`, {
        method: 'DELETE',
      });

      setMailboxes((prev) => prev.filter((m) => m.id !== mailbox.id));
    } catch (error) {
      console.error('Failed to delete mailbox:', error);
    }
  };

  const toggleActive = async (mailbox: Mailbox) => {
    try {
      const res = await fetch(`/api/admin/mailboxes/${mailbox.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !mailbox.isActive }),
      });
      const data = await res.json();

      if (data.mailbox) {
        setMailboxes((prev) =>
          prev.map((m) =>
            m.id === mailbox.id ? { ...m, isActive: !mailbox.isActive } : m
          )
        );
      }
    } catch (error) {
      console.error('Failed to toggle mailbox:', error);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-neutral-600">
          {mailboxes.length} mailbox{mailboxes.length !== 1 ? 'es' : ''}
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
        >
          + Add Mailbox
        </button>
      </div>

      {/* Mailboxes Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mailboxes.map((mailbox) => (
          <div
            key={mailbox.id}
            className={`bg-white rounded-xl border p-6 ${
              mailbox.isActive ? 'border-neutral-200' : 'border-neutral-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{mailbox.name}</h3>
                <p className="text-sm text-neutral-500">{mailbox.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {mailbox.isDefault && (
                  <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full">
                    Default
                  </span>
                )}
                {!mailbox.isActive && (
                  <span className="px-2 py-1 bg-neutral-100 text-neutral-600 text-xs rounded-full">
                    Inactive
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Emails</span>
                <span className="font-medium">{mailbox.emailCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Auto-reply</span>
                <span className={mailbox.autoReplyEnabled ? 'text-green-600' : 'text-neutral-400'}>
                  {mailbox.autoReplyEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Signature</span>
                <span className={mailbox.signature ? 'text-green-600' : 'text-neutral-400'}>
                  {mailbox.signature ? 'Set' : 'None'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-neutral-100">
              <button
                onClick={() => openEditModal(mailbox)}
                className="flex-1 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
              >
                Edit
              </button>
              <button
                onClick={() => toggleActive(mailbox)}
                className={`flex-1 px-3 py-2 text-sm rounded-lg transition ${
                  mailbox.isActive
                    ? 'text-orange-600 hover:bg-orange-50'
                    : 'text-green-600 hover:bg-green-50'
                }`}
              >
                {mailbox.isActive ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => handleDelete(mailbox)}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                disabled={mailbox.emailCount > 0}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {mailboxes.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          <div className="text-4xl mb-2">📬</div>
          <p>No mailboxes yet. Create one to start receiving emails.</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h3 className="font-semibold text-lg">
                {editingMailbox ? 'Edit Mailbox' : 'Create Mailbox'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!!editingMailbox}
                  placeholder="support@divinitycoin.com"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Support"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="rounded border-neutral-300"
                  />
                  <span className="text-sm">Set as default mailbox</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Signature
                </label>
                <textarea
                  value={form.signature}
                  onChange={(e) => setForm({ ...form, signature: e.target.value })}
                  placeholder="Best regards,&#10;The DivinityCoin Team"
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="border-t border-neutral-200 pt-4">
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={form.autoReplyEnabled}
                    onChange={(e) =>
                      setForm({ ...form, autoReplyEnabled: e.target.checked })
                    }
                    className="rounded border-neutral-300"
                  />
                  <span className="text-sm font-medium">Enable auto-reply</span>
                </label>

                {form.autoReplyEnabled && (
                  <>
                    <div className="mb-3">
                      <input
                        type="text"
                        value={form.autoReplySubject}
                        onChange={(e) =>
                          setForm({ ...form, autoReplySubject: e.target.value })
                        }
                        placeholder="Auto-reply subject"
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <textarea
                      value={form.autoReplyMessage}
                      onChange={(e) =>
                        setForm({ ...form, autoReplyMessage: e.target.value })
                      }
                      placeholder="Thank you for your email. We will get back to you shortly."
                      rows={3}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !form.email || !form.name}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition"
              >
                {loading ? 'Saving...' : editingMailbox ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
