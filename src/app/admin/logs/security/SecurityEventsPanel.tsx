// Recent entries from the cross-realm SecurityEvent stream, shown above the
// admin audit log. Server component; reads directly.

import { prisma } from '@/lib/db';

const SEVERITY_CLASS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  warn: 'bg-amber-100 text-amber-800',
  info: 'bg-neutral-100 text-neutral-700',
};

export default async function SecurityEventsPanel() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [events, counts] = await Promise.all([
    prisma.securityEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.securityEvent.groupBy({
      by: ['type'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { type: 'desc' } },
    }),
  ]);

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-neutral-900 mb-1">Security events</h2>
      <p className="text-sm text-neutral-600 mb-3">
        Sign-ins, failed authentications, partner API auth failures and rate-limit hits, IOC
        matches and volume anomalies across every realm. Last 24 hours by type, then the 50
        most recent.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {counts.length === 0 && <span className="text-sm text-neutral-500">Nothing in the last 24 hours.</span>}
        {counts.map((c) => (
          <span key={c.type} className="text-xs font-mono px-2 py-1 rounded-sm bg-neutral-100 text-neutral-800">
            {c.type} <strong>{c._count._all}</strong>
          </span>
        ))}
      </div>
      <div className="overflow-x-auto border border-neutral-200 rounded-lg">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Time</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Type</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Realm</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Subject</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">IP</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {events.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 whitespace-nowrap text-neutral-600">{e.createdAt.toISOString().replace('T', ' ').slice(0, 19)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-sm ${SEVERITY_CLASS[e.severity] ?? SEVERITY_CLASS.info}`}>{e.type}</span>
                </td>
                <td className="px-3 py-2 text-neutral-700">{e.realm ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-700">{e.subject ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-700">{e.ipAddress ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-500 max-w-md truncate">{e.details ? JSON.stringify(e.details) : ''}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-neutral-500">No events recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
