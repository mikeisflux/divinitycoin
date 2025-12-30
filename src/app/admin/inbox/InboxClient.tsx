'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Mailbox {
  id: string;
  email: string;
  name: string;
  unreadCount: number;
}

interface Email {
  id: string;
  mailboxId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  isRead: boolean;
  isStarred: boolean;
  isDeleted: boolean;
  folder: string;
  hasAttachments: boolean;
  receivedAt: string;
  mailbox: { id: string; email: string; name: string };
  attachments: { id: string; filename: string }[];
}

interface InboxClientProps {
  initialMailboxes: Mailbox[];
  initialEmails: Email[];
  initialFolderCounts: Record<string, number>;
  needsMigration?: boolean;
  oldEmailCount?: number;
}

const FOLDERS = [
  { id: 'INBOX', name: 'Inbox', icon: '📥' },
  { id: 'SENT', name: 'Sent', icon: '📤' },
  { id: 'DRAFTS', name: 'Drafts', icon: '📝' },
  { id: 'STARRED', name: 'Starred', icon: '⭐' },
  { id: 'SPAM', name: 'Spam', icon: '🚫' },
  { id: 'TRASH', name: 'Trash', icon: '🗑️' },
  { id: 'ARCHIVE', name: 'Archive', icon: '📦' },
];

export function InboxClient({ initialMailboxes, initialEmails, initialFolderCounts, needsMigration, oldEmailCount }: InboxClientProps) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>(initialMailboxes);
  const [showMigration, setShowMigration] = useState(needsMigration || false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [folderCounts, setFolderCounts] = useState(initialFolderCounts);
  const [selectedMailbox, setSelectedMailbox] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState('INBOX');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch emails when folder or mailbox changes
  useEffect(() => {
    fetchEmails();
  }, [selectedMailbox, selectedFolder]);

  const handleMigration = async () => {
    setMigrating(true);
    setMigrationResult(null);
    try {
      const res = await fetch('/api/admin/inbox/migrate', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMigrationResult(`Successfully migrated ${data.migrated} emails!`);
        setShowMigration(false);
        // Refresh the page to load migrated emails
        window.location.reload();
      } else {
        setMigrationResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setMigrationResult('Failed to migrate emails');
    } finally {
      setMigrating(false);
    }
  };

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMailbox) params.set('mailboxId', selectedMailbox);
      params.set('folder', selectedFolder === 'STARRED' ? 'INBOX' : selectedFolder);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/inbox?${params}`);
      const data = await res.json();

      let filteredEmails = data.emails || [];
      if (selectedFolder === 'STARRED') {
        filteredEmails = filteredEmails.filter((e: Email) => e.isStarred);
      }

      setEmails(filteredEmails);
      setFolderCounts(data.folderCounts || {});
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailClick = async (email: Email) => {
    setSelectedEmail(email);

    // Mark as read
    if (!email.isRead) {
      await fetch(`/api/admin/inbox/${email.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });

      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, isRead: true } : e))
      );
    }
  };

  const handleStar = async (emailId: string, isStarred: boolean) => {
    await fetch(`/api/admin/inbox/${emailId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isStarred: !isStarred }),
    });

    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, isStarred: !isStarred } : e))
    );

    if (selectedEmail?.id === emailId) {
      setSelectedEmail({ ...selectedEmail, isStarred: !isStarred });
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;

    await fetch('/api/admin/inbox/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailIds: Array.from(selectedIds),
        action,
      }),
    });

    setSelectedIds(new Set());
    fetchEmails();
  };

  const handleDelete = async (emailId: string) => {
    await fetch(`/api/admin/inbox/${emailId}`, {
      method: 'DELETE',
    });

    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map((e) => e.id)));
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getPreview = (email: Email) => {
    const text = email.textBody || '';
    return text.slice(0, 100) + (text.length > 100 ? '...' : '');
  };

  return (
    <div>
      {/* Migration Banner */}
      {showMigration && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900">Import Existing Emails</h3>
              <p className="text-sm text-blue-700">
                Found {oldEmailCount} emails in the old system. Would you like to import them?
              </p>
              {migrationResult && (
                <p className={`text-sm mt-2 ${migrationResult.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {migrationResult}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMigration(false)}
                className="px-4 py-2 text-sm text-blue-700 hover:bg-blue-100 rounded-lg"
              >
                Skip
              </button>
              <button
                onClick={handleMigration}
                disabled={migrating}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {migrating ? 'Importing...' : 'Import Emails'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-180px)] bg-white rounded-xl border border-neutral-200 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-neutral-200 flex flex-col">
        {/* Compose Button */}
        <div className="p-4">
          <button
            onClick={() => setShowCompose(true)}
            className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition flex items-center justify-center gap-2"
          >
            <span>✏️</span> Compose
          </button>
        </div>

        {/* Folders */}
        <nav className="flex-1 overflow-y-auto px-2">
          {FOLDERS.map((folder) => (
            <button
              key={folder.id}
              onClick={() => {
                setSelectedFolder(folder.id);
                setSelectedEmail(null);
              }}
              className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm mb-1 transition ${
                selectedFolder === folder.id
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <span className="flex items-center gap-3">
                <span>{folder.icon}</span>
                <span>{folder.name}</span>
              </span>
              {folderCounts[folder.id] > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  folder.id === 'INBOX' && folderCounts[folder.id] > 0
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-neutral-100 text-neutral-600'
                }`}>
                  {folderCounts[folder.id]}
                </span>
              )}
            </button>
          ))}

          {/* Mailboxes */}
          <div className="mt-6 mb-2 px-4 text-xs font-semibold text-neutral-500 uppercase">
            Mailboxes
          </div>
          {mailboxes.map((mailbox) => (
            <button
              key={mailbox.id}
              onClick={() => {
                setSelectedMailbox(selectedMailbox === mailbox.id ? null : mailbox.id);
                setSelectedEmail(null);
              }}
              className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm mb-1 transition ${
                selectedMailbox === mailbox.id
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <span className="truncate">{mailbox.name}</span>
              {mailbox.unreadCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                  {mailbox.unreadCount}
                </span>
              )}
            </button>
          ))}

          <Link
            href="/admin/inbox/mailboxes"
            className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700"
          >
            <span>⚙️</span> Manage Mailboxes
          </Link>
        </nav>
      </div>

      {/* Email List */}
      <div className={`flex-1 flex flex-col ${selectedEmail ? 'hidden md:flex md:w-1/3' : ''}`}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.size === emails.length && emails.length > 0}
              onChange={toggleSelectAll}
              className="rounded border-neutral-300"
            />
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => handleBulkAction('markAsRead')}
                  className="p-2 hover:bg-neutral-100 rounded"
                  title="Mark as read"
                >
                  ✓
                </button>
                <button
                  onClick={() => handleBulkAction('archive')}
                  className="p-2 hover:bg-neutral-100 rounded"
                  title="Archive"
                >
                  📦
                </button>
                <button
                  onClick={() => handleBulkAction('trash')}
                  className="p-2 hover:bg-neutral-100 rounded"
                  title="Delete"
                >
                  🗑️
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchEmails()}
              className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={fetchEmails}
              className="p-2 hover:bg-neutral-100 rounded"
              disabled={loading}
            >
              🔄
            </button>
          </div>
        </div>

        {/* Email List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-neutral-500">
              Loading...
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500">
              <span className="text-4xl mb-2">📭</span>
              <span>No emails in {selectedFolder.toLowerCase()}</span>
            </div>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                onClick={() => handleEmailClick(email)}
                className={`flex items-center px-4 py-3 border-b border-neutral-100 cursor-pointer transition ${
                  selectedEmail?.id === email.id
                    ? 'bg-primary-50'
                    : email.isRead
                    ? 'bg-white hover:bg-neutral-50'
                    : 'bg-blue-50 hover:bg-blue-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(email.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    const newSelected = new Set(selectedIds);
                    if (newSelected.has(email.id)) {
                      newSelected.delete(email.id);
                    } else {
                      newSelected.add(email.id);
                    }
                    setSelectedIds(newSelected);
                  }}
                  className="mr-3 rounded border-neutral-300"
                />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStar(email.id, email.isStarred);
                  }}
                  className={`mr-3 ${email.isStarred ? 'text-yellow-500' : 'text-neutral-300 hover:text-yellow-500'}`}
                >
                  ★
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm truncate ${!email.isRead ? 'font-semibold' : ''}`}>
                      {email.direction === 'INBOUND'
                        ? email.fromName || email.fromEmail
                        : `To: ${email.toEmail}`}
                    </span>
                    <span className="text-xs text-neutral-500 ml-2 whitespace-nowrap">
                      {formatDate(email.receivedAt)}
                    </span>
                  </div>
                  <div className={`text-sm truncate ${!email.isRead ? 'font-medium' : 'text-neutral-900'}`}>
                    {email.subject || '(no subject)'}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">
                    {getPreview(email)}
                  </div>
                </div>

                {email.hasAttachments && (
                  <span className="ml-2 text-neutral-400">📎</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Email Detail */}
      {selectedEmail && (
        <div className="flex-1 flex flex-col border-l border-neutral-200 md:w-2/3">
          {/* Detail Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <button
              onClick={() => setSelectedEmail(null)}
              className="md:hidden p-2 hover:bg-neutral-100 rounded"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStar(selectedEmail.id, selectedEmail.isStarred)}
                className={`p-2 rounded hover:bg-neutral-100 ${
                  selectedEmail.isStarred ? 'text-yellow-500' : 'text-neutral-400'
                }`}
              >
                ★
              </button>
              <button
                onClick={() => handleDelete(selectedEmail.id)}
                className="p-2 text-neutral-400 hover:text-red-500 hover:bg-neutral-100 rounded"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Email Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <h1 className="text-xl font-semibold mb-4">{selectedEmail.subject || '(no subject)'}</h1>

            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="font-medium">
                  {selectedEmail.fromName || selectedEmail.fromEmail}
                </div>
                <div className="text-sm text-neutral-500">
                  {selectedEmail.fromEmail}
                </div>
                <div className="text-sm text-neutral-500">
                  To: {selectedEmail.toEmail}
                </div>
              </div>
              <div className="text-sm text-neutral-500">
                {new Date(selectedEmail.receivedAt).toLocaleString()}
              </div>
            </div>

            {selectedEmail.attachments.length > 0 && (
              <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
                <div className="text-sm font-medium mb-2">Attachments</div>
                <div className="flex flex-wrap gap-2">
                  {selectedEmail.attachments.map((att) => (
                    <span
                      key={att.id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-neutral-200 rounded text-sm"
                    >
                      📎 {att.filename}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="prose max-w-none">
              {selectedEmail.htmlBody ? (
                <div dangerouslySetInnerHTML={{ __html: selectedEmail.htmlBody }} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans">{selectedEmail.textBody}</pre>
              )}
            </div>
          </div>

          {/* Reply Box */}
          <div className="border-t border-neutral-200 p-4">
            <button
              onClick={() => setShowCompose(true)}
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-sm font-medium transition"
            >
              ↩️ Reply
            </button>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          mailboxes={mailboxes}
          replyTo={selectedEmail}
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            fetchEmails();
          }}
        />
      )}
      </div>
    </div>
  );
}

// Compose Modal Component
function ComposeModal({
  mailboxes,
  replyTo,
  onClose,
  onSent,
}: {
  mailboxes: Mailbox[];
  replyTo: Email | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sendToAll, setSendToAll] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [form, setForm] = useState({
    mailboxId: mailboxes[0]?.id || '',
    to: replyTo ? replyTo.fromEmail : '',
    cc: '',
    subject: replyTo ? `Re: ${replyTo.subject}` : '',
    body: '',
  });

  // Fetch user count when sendToAll is toggled
  useEffect(() => {
    if (sendToAll && userCount === null) {
      fetch('/api/admin/users?limit=1')
        .then(res => res.json())
        .then(data => setUserCount(data.pagination?.total || 0))
        .catch(() => setUserCount(0));
    }
  }, [sendToAll, userCount]);

  const handleSend = async () => {
    if (!sendToAll && !form.to) return;
    if (!form.mailboxId) return;

    setSending(true);
    try {
      const res = await fetch('/api/admin/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxId: form.mailboxId,
          to: sendToAll ? undefined : form.to,
          cc: form.cc,
          subject: form.subject,
          htmlBody: form.body.replace(/\n/g, '<br>'),
          textBody: form.body,
          replyToEmailId: replyTo?.id,
          sendToAllUsers: sendToAll,
        }),
      });
      const data = await res.json();

      if (sendToAll && data.bulkSendId) {
        // Show queue info for bulk sends
        alert(`${data.totalUsers} emails queued for delivery.\nEstimated time: ${data.estimatedMinutes} minutes.\n\nView progress at: /admin/emails/queue`);
      }

      onSent();
    } catch (error) {
      console.error('Failed to send:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
      <div className="bg-white w-full max-w-2xl rounded-t-xl md:rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <h3 className="font-semibold">
            {replyTo ? 'Reply' : 'New Message'}
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500 w-16">From:</span>
            <select
              value={form.mailboxId}
              onChange={(e) => setForm({ ...form, mailboxId: e.target.value })}
              className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} &lt;{m.email}&gt;
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500 w-16">To:</span>
            <input
              type="email"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
              placeholder="recipient@example.com"
              disabled={sendToAll}
              className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
            />
          </div>

          {!replyTo && (
            <div className="flex items-center gap-2 px-2 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="sendToAll"
                checked={sendToAll}
                onChange={(e) => setSendToAll(e.target.checked)}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="sendToAll" className="text-sm text-amber-800 cursor-pointer">
                Send to all registered users
                {sendToAll && userCount !== null && (
                  <span className="ml-1 font-medium">({userCount} users)</span>
                )}
              </label>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500 w-16">Cc:</span>
            <input
              type="text"
              value={form.cc}
              onChange={(e) => setForm({ ...form, cc: e.target.value })}
              placeholder="cc@example.com"
              className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500 w-16">Subject:</span>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Subject"
              className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Write your message..."
            rows={10}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800"
          >
            Discard
          </button>
          <button
            onClick={handleSend}
            disabled={sending || (!sendToAll && !form.to)}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
