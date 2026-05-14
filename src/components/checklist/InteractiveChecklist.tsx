// components/checklist/InteractiveChecklist.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/Card';

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  description?: string;
}

interface ChecklistSection {
  id: string;
  title: string;
  description?: string;
  items: ChecklistItem[];
}

interface InteractiveChecklistProps {
  sections: ChecklistSection[];
  storageKey?: string;
  onProgressChange?: (completed: number, total: number) => void;
}

export function InteractiveChecklist({
  sections,
  storageKey = 'checklist-progress',
  onProgressChange
}: InteractiveChecklistProps) {
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(sections.map(s => s.id)));

  // Load saved progress from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setCompletedItems(new Set(parsed));
        } catch {
          // Invalid data, start fresh
        }
      }
    }
  }, [storageKey]);

  // Calculate progress
  const totalItems = sections.reduce((acc, section) => acc + section.items.length, 0);
  const completedCount = completedItems.size;

  // Notify parent of progress changes
  useEffect(() => {
    onProgressChange?.(completedCount, totalItems);
  }, [completedCount, totalItems, onProgressChange]);

  const toggleItem = useCallback((itemId: string) => {
    setCompletedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  }, [storageKey]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const getSectionProgress = (section: ChecklistSection) => {
    const completed = section.items.filter(item => completedItems.has(item.id)).length;
    return { completed, total: section.items.length };
  };

  const resetProgress = () => {
    setCompletedItems(new Set());
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
  };

  const markAllComplete = () => {
    const allIds = sections.flatMap(s => s.items.map(i => i.id));
    setCompletedItems(new Set(allIds));
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(allIds));
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card className="p-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Integration Progress</h3>
              <p className="text-sm text-neutral-600">
                {completedCount} of {totalItems} steps completed
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetProgress}
                className="text-sm text-neutral-500 hover:text-neutral-700 px-3 py-1 rounded border border-neutral-300 hover:border-neutral-400 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={markAllComplete}
                className="text-sm text-primary-600 hover:text-primary-700 px-3 py-1 rounded border border-primary-300 hover:border-primary-400 transition-colors"
              >
                Mark All Complete
              </button>
            </div>
          </div>
          <div className="w-full bg-neutral-200 rounded-full h-3">
            <div
              className="bg-primary-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${totalItems > 0 ? (completedCount / totalItems) * 100 : 0}%` }}
            />
          </div>
          <p className="text-right text-sm text-neutral-500 mt-1">
            {totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0}% complete
          </p>
        </CardContent>
      </Card>

      {/* Sections */}
      {sections.map((section) => {
        const { completed, total } = getSectionProgress(section);
        const isExpanded = expandedSections.has(section.id);
        const isComplete = completed === total;

        return (
          <Card key={section.id} className={`p-0 ${isComplete ? 'border-green-200 bg-green-50/30' : ''}`}>
            <div
              className="cursor-pointer hover:bg-neutral-50 transition-colors rounded-t-xl p-6 pb-4"
              onClick={() => toggleSection(section.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : 'bg-neutral-200 text-neutral-600'
                  }`}>
                    {isComplete ? '✓' : completed}
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900">{section.title}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-neutral-500">
                    {completed}/{total}
                  </span>
                  <svg
                    className={`w-5 h-5 text-neutral-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {section.description && (
                <p className="text-sm text-neutral-600 mt-1 ml-9">{section.description}</p>
              )}
            </div>
            {isExpanded && (
              <div className="px-6 pb-6">
                <div className="space-y-2 ml-9">
                  {section.items.map((item) => {
                    const isChecked = completedItems.has(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'bg-neutral-50 hover:bg-neutral-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleItem(item.id)}
                          className="mt-0.5 w-5 h-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <span className={`block ${isChecked ? 'line-through text-neutral-500' : 'text-neutral-900'}`}>
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="block text-sm text-neutral-500 mt-1">
                              {item.description}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// Settlement & Payout Integration Checklist Data (from creatorcredits-addendum-settlements.md)
export const settlementChecklistData: ChecklistSection[] = [
  {
    id: 'money-flow',
    title: '1. Money Flow Overview',
    description: 'Understand the complete money flow from credit purchases to creator bank accounts',
    items: [
      { id: 'flow-1', label: 'Understand credit purchase flow (User → Payment → CreatorCredits)', completed: false, description: 'User buys $100 credits, payment is processed, funds held by CreatorCredits' },
      { id: 'flow-2', label: 'Understand code redemption flow', completed: false, description: 'User redeems code on partner platform, credits added to balance via VPN validation' },
      { id: 'flow-3', label: 'Understand hold/capture mechanism', completed: false, description: 'Credits reserved when user backs a project, captured when project funds' },
      { id: 'flow-4', label: 'Understand settlement process', completed: false, description: 'CreatorCredits pays partner (weekly/monthly) after 6% total fee' },
      { id: 'flow-5', label: 'Understand creator payout flow', completed: false, description: 'Partner pays creator via their payout provider after 5% platform fee' },
    ]
  },
  {
    id: 'fee-structure',
    title: '2. Fee Structure',
    description: 'Configure and understand the 6% total partner fee',
    items: [
      { id: 'fee-1', label: 'Configure total partner fee (default 6%)', completed: false, description: 'Located at /admin/settings/payments' },
      { id: 'fee-2', label: 'Understand fee breakdown: card processing (~2.9% + $0.30)', completed: false },
      { id: 'fee-3', label: 'Understand fee breakdown: CreatorCredits platform (~2.8%)', completed: false },
      { id: 'fee-4', label: 'Configure per-partner fee override (if needed)', completed: false, description: 'Custom fee for specific partners at /admin/partners/:id' },
      { id: 'fee-5', label: 'Document fee flow for accounting: $100 → $94 to partner → $89.30 to creator', completed: false },
    ]
  },
  {
    id: 'database-schema',
    title: '3. Settlement Database Schema',
    description: 'Add settlement models to Prisma schema',
    items: [
      { id: 'db-1', label: 'Add PartnerSettlement model', completed: false, description: 'Fields: id, partnerId, periodStart, periodEnd, grossAmount, partnerFee, netAmount, status, paymentMethod, paymentRef, paidAt' },
      { id: 'db-2', label: 'Add SettlementStatus enum', completed: false, description: 'PENDING, APPROVED, PROCESSING, PAID, FAILED, DISPUTED' },
      { id: 'db-3', label: 'Add CreditCapture model', completed: false, description: 'Fields: id, holdId, partnerId, creatorId, creatorEmail, projectId, projectName, amount, settlementId, settledAt, capturedAt' },
      { id: 'db-4', label: 'Update Partner model with settlement fields', completed: false, description: 'Add: settlementFrequency, settlementDay, minimumSettlement, partnerFeeOverride' },
      { id: 'db-5', label: 'Add SettlementFrequency enum', completed: false, description: 'DAILY, WEEKLY, BIWEEKLY, MONTHLY' },
      { id: 'db-6', label: 'Add Partner payment details fields', completed: false, description: 'paymentMethod, bankName, bankAccountNumber (encrypted), bankRoutingNumber, bankSwiftCode, paypalEmail, processorAccountId' },
      { id: 'db-7', label: 'Create database indexes for performance', completed: false, description: 'Index on partnerId, status, periodEnd, capturedAt, creatorId' },
      { id: 'db-8', label: 'Run Prisma migration', completed: false },
    ]
  },
  {
    id: 'settlement-config',
    title: '4. Settlement Configuration',
    description: 'Set up admin settings for settlements',
    items: [
      { id: 'config-1', label: 'Create /admin/settings/settlements page', completed: false },
      { id: 'config-2', label: 'Add default settlement frequency setting (Weekly)', completed: false },
      { id: 'config-3', label: 'Add default settlement day setting (Monday)', completed: false },
      { id: 'config-4', label: 'Add default minimum settlement amount ($100.00)', completed: false },
      { id: 'config-5', label: 'Add auto-approve threshold ($1,000.00)', completed: false },
      { id: 'config-6', label: 'Add auto-approve toggle', completed: false },
      { id: 'config-7', label: 'Add settlement notification email setting', completed: false },
      { id: 'config-8', label: 'Create /admin/partners/:id/settlements page', completed: false, description: 'Per-partner override settings' },
    ]
  },
  {
    id: 'settlement-process',
    title: '5. Settlement Process Automation',
    description: 'Implement automatic settlement generation',
    items: [
      { id: 'process-1', label: 'Create scheduled settlement generation job', completed: false, description: 'Runs based on partner frequency: Daily/Weekly/Biweekly/Monthly at 00:00 UTC' },
      { id: 'process-2', label: 'Implement settlement calculation function', completed: false, description: 'Sum unsettled captures, calculate grossAmount, partnerFee (6%), netAmount' },
      { id: 'process-3', label: 'Check minimum settlement threshold before generation', completed: false },
      { id: 'process-4', label: 'Create settlement record and link captures', completed: false },
      { id: 'process-5', label: 'Implement auto-approval for settlements under threshold', completed: false },
      { id: 'process-6', label: 'Send admin notification when settlement created', completed: false },
    ]
  },
  {
    id: 'admin-interface',
    title: '6. Admin Settlement Interface',
    description: 'Build the admin UI for managing settlements',
    items: [
      { id: 'admin-1', label: 'Create /admin/settlements list page', completed: false, description: 'Columns: ID, Partner, Period, Captures, Gross, Fee, Net, Status, Created, Actions' },
      { id: 'admin-2', label: 'Add filters: Partner, Status, Date Range, Amount Range', completed: false },
      { id: 'admin-3', label: 'Add bulk actions: Approve selected, Export to CSV', completed: false },
      { id: 'admin-4', label: 'Add quick stats: Total pending, Paid this month/year', completed: false },
      { id: 'admin-5', label: 'Create /admin/settlements/:id detail page', completed: false },
      { id: 'admin-6', label: 'Show summary: Partner, Period, Captures count, Gross/Fee/Net amounts', completed: false },
      { id: 'admin-7', label: 'Show captures breakdown by creator', completed: false },
      { id: 'admin-8', label: 'Show detailed capture list with project info', completed: false },
      { id: 'admin-9', label: 'Add payment section with bank details display', completed: false },
      { id: 'admin-10', label: 'Add payment reference input field', completed: false },
      { id: 'admin-11', label: 'Implement Approve button (PENDING → APPROVED)', completed: false },
      { id: 'admin-12', label: 'Implement Process Payment button (APPROVED → PROCESSING)', completed: false },
      { id: 'admin-13', label: 'Implement Mark as Paid button (PROCESSING → PAID)', completed: false },
      { id: 'admin-14', label: 'Implement Mark as Failed button', completed: false },
      { id: 'admin-15', label: 'Implement Dispute button', completed: false },
      { id: 'admin-16', label: 'Add history/timeline section', completed: false },
      { id: 'admin-17', label: 'Add notes section', completed: false },
      { id: 'admin-18', label: 'Create /admin/partners/:id/payments page', completed: false, description: 'Configure payment method, bank details, settlement settings' },
    ]
  },
  {
    id: 'partner-api',
    title: '7. Partner Settlement API',
    description: 'Implement internal API endpoints for partners (VPN access via /internal)',
    items: [
      { id: 'api-1', label: 'Implement GET /internal?action=settlements', completed: false, description: 'List settlements with filters: status, limit, offset, from, to, partnerId' },
      { id: 'api-2', label: 'Implement GET /internal?action=settlement&id=X', completed: false, description: 'Detailed settlement with capture breakdown, summary by creator/project' },
      { id: 'api-3', label: 'Implement GET /internal?action=captures', completed: false, description: 'Query unsettled captures with filters: settled, creatorId, projectId, from, to' },
      { id: 'api-4', label: 'Implement POST /internal?action=record_capture', completed: false, description: 'Record capture metadata: holdId, partnerId, creatorId, creatorEmail, projectId, projectName, amount' },
      { id: 'api-5', label: 'Add Bearer token authorization (Authorization: Bearer <INTERNAL_API_KEY>)', completed: false },
      { id: 'api-6', label: 'Add proper pagination to all list endpoints', completed: false },
      { id: 'api-7', label: 'Partner session API: GET /api/partners/settlements', completed: false, description: 'Alternative endpoint using partner session auth instead of VPN' },
      { id: 'api-8', label: 'Partner session API: GET /api/partners/captures', completed: false, description: 'Alternative endpoint using partner session auth instead of VPN' },
    ]
  },
  {
    id: 'creator-payout',
    title: '8. Creator Payout (Reference)',
    description: 'Reference implementation for partner-side creator payouts',
    items: [
      { id: 'payout-1', label: 'Document payout provider integration', completed: false },
      { id: 'payout-2', label: 'Document CreatorBalance model schema', completed: false, description: 'availableBalance, pendingBalance, lifetimeEarnings, lifetimePaid' },
      { id: 'payout-3', label: 'Document CreatorEarning model schema', completed: false, description: 'Track earnings by source (DIRECT or CREDITS)' },
      { id: 'payout-4', label: 'Document CreatorPayout model schema', completed: false },
      { id: 'payout-5', label: 'Document balance update flow when project funds', completed: false },
      { id: 'payout-6', label: 'Document balance update flow when settlement received', completed: false },
      { id: 'payout-7', label: 'Document payout configuration: Minimum $25, Auto-payout threshold $500', completed: false },
    ]
  },
  {
    id: 'reports',
    title: '9. Settlement Reports',
    description: 'Build settlement reporting functionality',
    items: [
      { id: 'report-1', label: 'Create /admin/reports/settlements page', completed: false },
      { id: 'report-2', label: 'Implement Settlement Summary report', completed: false, description: 'Total settled by period, by partner' },
      { id: 'report-3', label: 'Implement Unsettled Captures report', completed: false },
      { id: 'report-4', label: 'Implement Platform Fee Revenue report', completed: false },
      { id: 'report-5', label: 'Implement Partner Performance report', completed: false, description: 'Volume trends by partner' },
      { id: 'report-6', label: 'Implement Settlement Aging report', completed: false, description: 'Time from capture to settlement to payment' },
      { id: 'report-7', label: 'Add export to CSV', completed: false },
      { id: 'report-8', label: 'Add export to Excel (formatted with multiple sheets)', completed: false },
      { id: 'report-9', label: 'Add export to PDF (settlement statements)', completed: false },
      { id: 'report-10', label: 'Configure scheduled reports: Weekly summary, Monthly statements, Quarterly revenue', completed: false },
    ]
  },
  {
    id: 'notifications',
    title: '10. Settlement Notifications',
    description: 'Set up email and webhook notifications',
    items: [
      { id: 'notif-1', label: 'Create settlement created email template (to Admin)', completed: false },
      { id: 'notif-2', label: 'Create settlement paid email template (to Partner)', completed: false },
      { id: 'notif-3', label: 'Create payment failed email template', completed: false },
      { id: 'notif-4', label: 'Send email when settlement > $10K created', completed: false },
      { id: 'notif-5', label: 'Implement partner webhook delivery system', completed: false },
      { id: 'notif-6', label: 'Add webhook configuration to partner settings', completed: false, description: 'Webhook URL, Secret, Event subscriptions' },
      { id: 'notif-7', label: 'Implement settlement.created webhook event', completed: false },
      { id: 'notif-8', label: 'Implement settlement.approved webhook event', completed: false },
      { id: 'notif-9', label: 'Implement settlement.processing webhook event', completed: false },
      { id: 'notif-10', label: 'Implement settlement.paid webhook event', completed: false },
      { id: 'notif-11', label: 'Implement settlement.failed webhook event', completed: false },
      { id: 'notif-12', label: 'Add HMAC-SHA256 signature to webhook payloads', completed: false },
    ]
  },
  {
    id: 'testing',
    title: '11. Testing & Verification',
    description: 'Test the complete settlement flow',
    items: [
      { id: 'test-1', label: 'Settlement generation calculates correctly', completed: false },
      { id: 'test-2', label: 'Platform fees (6%) applied correctly', completed: false },
      { id: 'test-3', label: 'Captures linked to settlements properly', completed: false },
      { id: 'test-4', label: 'Settlement approval workflow functions', completed: false },
      { id: 'test-5', label: 'Payment marking workflow functions', completed: false },
      { id: 'test-6', label: 'Partner API returns correct data', completed: false },
      { id: 'test-7', label: 'Webhooks delivered successfully', completed: false },
      { id: 'test-8', label: 'Reports generate accurately', completed: false },
      { id: 'test-9', label: 'Email notifications sent', completed: false },
    ]
  }
];

// Export type for external use
export type { ChecklistSection, ChecklistItem };
