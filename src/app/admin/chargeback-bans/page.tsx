// app/admin/chargeback-bans/page.tsx
// Operator console for the chargeback-ban prefilter. Three tabs:
//   - Matches: every time the prefilter fired, including would-have-blocked
//   - Signals: cached ban list per partner
//   - CGNAT allowlist: IPs to ignore even if they appear in the feed

'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';

type Tab = 'matches' | 'signals' | 'cgnat';

interface MatchRow {
  id: string;
  decision: 'HARD_BLOCK' | 'SOFT_FLAG' | 'ALLOW' | 'LOGGED_ONLY';
  intendedDecision: 'HARD_BLOCK' | 'SOFT_FLAG' | 'ALLOW' | 'LOGGED_ONLY';
  matchedSignals: string[];
  sourceUserIds: string[];
  attemptedAction: string;
  attemptedAmountCents: number | null;
  attemptedCurrency: string | null;
  attemptedEmail: string | null;
  attemptedIp: string | null;
  attemptedCardLast4: string | null;
  attemptedCardBrand: string | null;
  attemptedBillingPostal: string | null;
  attemptedPlatformUserId: string | null;
  attemptedPledgeId: string | null;
  feedTimestamp: string | null;
  reportedAt: string | null;
  reportError: string | null;
  createdAt: string;
}

interface SignalRow {
  id: string;
  sourceUserId: string;
  partnerName: string;
  partnerSlug: string;
  bannedAt: string;
  reason: string;
  lastSeenAt: string;
  removedAt: string | null;
  identifierCounts: Record<string, number>;
  identifiers: Array<{ type: string; value: string }>;
}

interface CgnatRow {
  id: string;
  ipAddress: string;
  note: string | null;
  addedBy: string | null;
  createdAt: string;
}

const DECISION_STYLES: Record<string, string> = {
  HARD_BLOCK:   'bg-red-100 text-red-800',
  SOFT_FLAG:    'bg-amber-100 text-amber-800',
  LOGGED_ONLY:  'bg-blue-100 text-blue-800',
  ALLOW:        'bg-green-100 text-green-800',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
function formatMoney(cents: number | null, currency: string | null): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency ?? 'usd').toUpperCase(),
  }).format(cents / 100);
}

export default function ChargebackBansPage() {
  const [tab, setTab] = useState<Tab>('matches');
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [cgnat, setCgnat] = useState<CgnatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newIp, setNewIp] = useState('');
  const [newIpNote, setNewIpNote] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, s, c] = await Promise.all([
        fetch('/api/admin/chargeback-bans/matches').then((r) => r.json()),
        fetch('/api/admin/chargeback-bans/signals').then((r) => r.json()),
        fetch('/api/admin/chargeback-bans/cgnat').then((r) => r.json()),
      ]);
      setMatches(m.matches ?? []);
      setSignals(s.signals ?? []);
      setCgnat(c.ips ?? []);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleAddCgnat(e: React.FormEvent) {
    e.preventDefault();
    const ipAddress = newIp.trim();
    if (!ipAddress) return;
    const res = await fetch('/api/admin/chargeback-bans/cgnat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipAddress, note: newIpNote.trim() || null }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? 'Failed to add IP');
      return;
    }
    setNewIp('');
    setNewIpNote('');
    fetchAll();
  }

  async function handleRemoveCgnat(id: string) {
    const res = await fetch(`/api/admin/chargeback-bans/cgnat?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) fetchAll();
  }

  async function handleSync(slug: string) {
    setSyncBusy(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/chargeback-bans/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerSlug: slug }),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setSyncResult(
          `Synced ${slug}: ${body.signalsTotal} total, +${body.signalsAdded} new, ~${body.signalsUpdated} updated, -${body.signalsRemoved} removed`,
        );
      } else {
        setSyncResult(`Sync failed: ${body.error ?? 'unknown'}`);
      }
      fetchAll();
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <AdminLayout
      title="Chargeback Ban Prefilter"
      description="Cached ban signals from partner feeds, match log, and CGNAT allowlist."
      actions={
        <button
          onClick={() => handleSync('indiecrowdfund-com')}
          disabled={syncBusy}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {syncBusy ? 'Syncing…' : 'Sync IndieCrowdfund now'}
        </button>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        {syncResult && (
          <div className="p-3 rounded-md bg-blue-50 text-blue-700 text-sm">{syncResult}</div>
        )}

        <div className="border-b border-neutral-200 flex gap-1">
          {([
            ['matches', `Matches (${matches.length})`],
            ['signals', `Signals (${signals.length})`],
            ['cgnat',   `CGNAT (${cgnat.length})`],
          ] as Array<[Tab, string]>).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px ' +
                (tab === k
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700')
              }
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center text-neutral-500 text-sm">Loading…</div>
        ) : tab === 'matches' ? (
          <MatchesTable rows={matches} />
        ) : tab === 'signals' ? (
          <SignalsTable rows={signals} />
        ) : (
          <CgnatTable
            rows={cgnat}
            newIp={newIp}
            newIpNote={newIpNote}
            onChangeIp={setNewIp}
            onChangeNote={setNewIpNote}
            onAdd={handleAddCgnat}
            onRemove={handleRemoveCgnat}
          />
        )}
      </div>
    </AdminLayout>
  );
}

function MatchesTable({ rows }: { rows: MatchRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-neutral-500 text-sm bg-white rounded-md border border-neutral-200">
        No prefilter matches yet. They'll appear here when an inbound charge matches a signal.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto bg-white rounded-md border border-neutral-200">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
          <tr>
            <th className="px-3 py-2 text-left">When</th>
            <th className="px-3 py-2 text-left">Decision</th>
            <th className="px-3 py-2 text-left">Matched on</th>
            <th className="px-3 py-2 text-left">Action</th>
            <th className="px-3 py-2 text-left">Email</th>
            <th className="px-3 py-2 text-left">IP</th>
            <th className="px-3 py-2 text-left">Amount</th>
            <th className="px-3 py-2 text-left">Pledge</th>
            <th className="px-3 py-2 text-left">Reported back</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 whitespace-nowrap text-neutral-500">{formatDate(r.createdAt)}</td>
              <td className="px-3 py-2">
                <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (DECISION_STYLES[r.decision] ?? '')}>
                  {r.decision}
                </span>
                {r.decision === 'LOGGED_ONLY' && r.intendedDecision !== r.decision && (
                  <span className="ml-1 text-xs text-neutral-500">→ would {r.intendedDecision}</span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {r.matchedSignals.map((s) => (
                    <span key={s} className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2 text-neutral-600">{r.attemptedAction}</td>
              <td className="px-3 py-2">{r.attemptedEmail ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.attemptedIp ?? '—'}</td>
              <td className="px-3 py-2">{formatMoney(r.attemptedAmountCents, r.attemptedCurrency)}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.attemptedPledgeId ?? '—'}</td>
              <td className="px-3 py-2 text-xs">
                {r.reportedAt
                  ? <span className="text-green-700">✓ {formatDate(r.reportedAt)}</span>
                  : r.reportError
                    ? <span className="text-red-700" title={r.reportError}>error</span>
                    : <span className="text-neutral-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignalsTable({ rows }: { rows: SignalRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-neutral-500 text-sm bg-white rounded-md border border-neutral-200">
        No signals cached. Run "Sync now" or wait for the cron.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto bg-white rounded-md border border-neutral-200">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
          <tr>
            <th className="px-3 py-2 text-left">Banned at</th>
            <th className="px-3 py-2 text-left">Partner</th>
            <th className="px-3 py-2 text-left">Source user ID</th>
            <th className="px-3 py-2 text-left">Reason</th>
            <th className="px-3 py-2 text-left">Identifier counts</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2 whitespace-nowrap text-neutral-500">{formatDate(s.bannedAt)}</td>
              <td className="px-3 py-2">{s.partnerName}</td>
              <td className="px-3 py-2 font-mono text-xs">{s.sourceUserId}</td>
              <td className="px-3 py-2">{s.reason}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(s.identifierCounts).map(([type, count]) => (
                    <span key={type} className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 text-xs">
                      {type.toLowerCase()}: {count}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2">
                {s.removedAt
                  ? <span className="text-neutral-500 text-xs">removed {formatDate(s.removedAt)}</span>
                  : <span className="text-green-700 text-xs">active</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CgnatTable(props: {
  rows: CgnatRow[];
  newIp: string;
  newIpNote: string;
  onChangeIp: (v: string) => void;
  onChangeNote: (v: string) => void;
  onAdd: (e: React.FormEvent) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <form
        onSubmit={props.onAdd}
        className="bg-white rounded-md border border-neutral-200 p-4 flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="block text-xs uppercase text-neutral-500 mb-1">IP address</label>
          <input
            value={props.newIp}
            onChange={(e) => props.onChangeIp(e.target.value)}
            placeholder="73.9.8.34"
            className="border border-neutral-300 rounded px-2 py-1 text-sm font-mono w-48"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs uppercase text-neutral-500 mb-1">Note</label>
          <input
            value={props.newIpNote}
            onChange={(e) => props.onChangeNote(e.target.value)}
            placeholder="T-Mobile CGNAT exit, seen on legit pledges"
            className="border border-neutral-300 rounded px-2 py-1 text-sm w-full"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 bg-neutral-900 text-white text-sm rounded hover:bg-neutral-700"
        >
          Add IP
        </button>
      </form>
      {props.rows.length === 0 ? (
        <div className="p-8 text-center text-neutral-500 text-sm bg-white rounded-md border border-neutral-200">
          No CGNAT IPs in the allowlist.
        </div>
      ) : (
        <div className="bg-white rounded-md border border-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">IP</th>
                <th className="px-3 py-2 text-left">Note</th>
                <th className="px-3 py-2 text-left">Added by</th>
                <th className="px-3 py-2 text-left">Added</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {props.rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-mono text-xs">{r.ipAddress}</td>
                  <td className="px-3 py-2">{r.note ?? '—'}</td>
                  <td className="px-3 py-2 text-neutral-600">{r.addedBy ?? '—'}</td>
                  <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => props.onRemove(r.id)}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
