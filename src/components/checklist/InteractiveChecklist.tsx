// components/checklist/InteractiveChecklist.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

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
        localStorage.setItem(storageKey, JSON.stringify([...next]));
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
      <Card>
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
          <Card key={section.id} className={isComplete ? 'border-green-200 bg-green-50/30' : ''}>
            <CardHeader
              className="cursor-pointer hover:bg-neutral-50 transition-colors"
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
                  <CardTitle className="text-lg">{section.title}</CardTitle>
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
            </CardHeader>
            {isExpanded && (
              <CardContent className="pt-0">
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
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// Pre-built integration checklist data
export const integrationChecklistData: ChecklistSection[] = [
  {
    id: 'setup',
    title: '1. Initial Setup',
    description: 'Get your development environment ready',
    items: [
      { id: 'setup-1', label: 'Apply for partner account', completed: false, description: 'Submit your application at /become-a-partner' },
      { id: 'setup-2', label: 'Receive partner approval email', completed: false },
      { id: 'setup-3', label: 'Set up partner account password', completed: false, description: 'Use the setup link from approval email' },
      { id: 'setup-4', label: 'Access partner dashboard', completed: false },
      { id: 'setup-5', label: 'Generate sandbox API key', completed: false, description: 'For testing in development environment' },
      { id: 'setup-6', label: 'Store API key securely', completed: false, description: 'Never commit API keys to version control' },
    ]
  },
  {
    id: 'authentication',
    title: '2. Authentication Setup',
    description: 'Configure API authentication',
    items: [
      { id: 'auth-1', label: 'Set up Authorization header', completed: false, description: 'Use Bearer token format' },
      { id: 'auth-2', label: 'Configure environment variables', completed: false, description: 'DIVINITYCOIN_API_KEY, DIVINITYCOIN_WEBHOOK_SECRET' },
      { id: 'auth-3', label: 'Test authentication with /v1/health endpoint', completed: false },
      { id: 'auth-4', label: 'Handle 401 unauthorized errors', completed: false },
    ]
  },
  {
    id: 'redemption',
    title: '3. Credit Redemption',
    description: 'Implement code redemption flow',
    items: [
      { id: 'redeem-1', label: 'Create redemption UI component', completed: false, description: 'Input field for 16-character code' },
      { id: 'redeem-2', label: 'Format code input (XXXX-XXXX-XXXX-XXXX)', completed: false },
      { id: 'redeem-3', label: 'Implement POST /v1/credits/redeem', completed: false },
      { id: 'redeem-4', label: 'Handle successful redemption response', completed: false, description: 'Update user balance display' },
      { id: 'redeem-5', label: 'Handle error codes (invalid_code, code_already_redeemed, code_expired)', completed: false },
      { id: 'redeem-6', label: 'Display user-friendly error messages', completed: false },
      { id: 'redeem-7', label: 'Add rate limiting protection', completed: false, description: 'Prevent brute force attempts' },
    ]
  },
  {
    id: 'balance',
    title: '4. Balance Management',
    description: 'Display and manage user credit balances',
    items: [
      { id: 'balance-1', label: 'Implement GET /v1/credits/balance', completed: false },
      { id: 'balance-2', label: 'Display available balance', completed: false },
      { id: 'balance-3', label: 'Display held balance (if applicable)', completed: false },
      { id: 'balance-4', label: 'Add balance refresh functionality', completed: false },
      { id: 'balance-5', label: 'Cache balance with appropriate TTL', completed: false },
    ]
  },
  {
    id: 'holds',
    title: '5. Credit Holds (Optional)',
    description: 'For pledge-based or pre-authorization flows',
    items: [
      { id: 'hold-1', label: 'Implement POST /v1/credits/hold', completed: false, description: 'Reserve credits for pending transactions' },
      { id: 'hold-2', label: 'Store holdId for later capture/release', completed: false },
      { id: 'hold-3', label: 'Implement POST /v1/credits/capture', completed: false, description: 'Finalize held credits' },
      { id: 'hold-4', label: 'Implement POST /v1/credits/release', completed: false, description: 'Release unused holds' },
      { id: 'hold-5', label: 'Handle hold expiration', completed: false },
      { id: 'hold-6', label: 'Display held vs available balance', completed: false },
    ]
  },
  {
    id: 'webhooks',
    title: '6. Webhook Integration',
    description: 'Receive real-time event notifications',
    items: [
      { id: 'webhook-1', label: 'Create webhook endpoint', completed: false, description: 'POST /api/webhooks/divinitycoin' },
      { id: 'webhook-2', label: 'Implement signature verification', completed: false, description: 'HMAC-SHA256 validation' },
      { id: 'webhook-3', label: 'Handle credit.redeemed event', completed: false },
      { id: 'webhook-4', label: 'Handle credit.held event', completed: false },
      { id: 'webhook-5', label: 'Handle credit.captured event', completed: false },
      { id: 'webhook-6', label: 'Handle credit.released event', completed: false },
      { id: 'webhook-7', label: 'Return 200 OK for processed events', completed: false },
      { id: 'webhook-8', label: 'Implement idempotency checks', completed: false, description: 'Prevent duplicate processing' },
      { id: 'webhook-9', label: 'Configure webhook URL in partner dashboard', completed: false },
      { id: 'webhook-10', label: 'Test webhook with partner dashboard test button', completed: false },
    ]
  },
  {
    id: 'error-handling',
    title: '7. Error Handling',
    description: 'Robust error handling and user feedback',
    items: [
      { id: 'error-1', label: 'Handle network errors gracefully', completed: false },
      { id: 'error-2', label: 'Implement retry logic with exponential backoff', completed: false },
      { id: 'error-3', label: 'Map API error codes to user messages', completed: false },
      { id: 'error-4', label: 'Log errors for debugging', completed: false },
      { id: 'error-5', label: 'Handle rate_limit_exceeded (429)', completed: false },
      { id: 'error-6', label: 'Handle server errors (5xx)', completed: false },
    ]
  },
  {
    id: 'testing',
    title: '8. Testing',
    description: 'Verify integration works correctly',
    items: [
      { id: 'test-1', label: 'Test redemption with sandbox codes', completed: false },
      { id: 'test-2', label: 'Test balance retrieval', completed: false },
      { id: 'test-3', label: 'Test hold/capture/release flow', completed: false },
      { id: 'test-4', label: 'Test error scenarios', completed: false },
      { id: 'test-5', label: 'Test webhook signature verification', completed: false },
      { id: 'test-6', label: 'Test rate limiting behavior', completed: false },
      { id: 'test-7', label: 'Perform load testing', completed: false },
      { id: 'test-8', label: 'Test edge cases (zero balance, max amounts)', completed: false },
    ]
  },
  {
    id: 'security',
    title: '9. Security Review',
    description: 'Ensure secure implementation',
    items: [
      { id: 'security-1', label: 'API keys stored in environment variables', completed: false },
      { id: 'security-2', label: 'API keys not exposed to client-side code', completed: false },
      { id: 'security-3', label: 'HTTPS used for all API calls', completed: false },
      { id: 'security-4', label: 'Webhook signatures validated', completed: false },
      { id: 'security-5', label: 'Input sanitization implemented', completed: false },
      { id: 'security-6', label: 'Rate limiting on redemption endpoint', completed: false },
      { id: 'security-7', label: 'Audit logging for credit operations', completed: false },
    ]
  },
  {
    id: 'production',
    title: '10. Go Live',
    description: 'Deploy to production',
    items: [
      { id: 'prod-1', label: 'Request production API key', completed: false },
      { id: 'prod-2', label: 'Update environment variables', completed: false },
      { id: 'prod-3', label: 'Configure production webhook URL', completed: false },
      { id: 'prod-4', label: 'Test with small real transaction', completed: false },
      { id: 'prod-5', label: 'Set up monitoring and alerts', completed: false },
      { id: 'prod-6', label: 'Document integration for your team', completed: false },
      { id: 'prod-7', label: 'Announce DivinityCoin support to users', completed: false },
    ]
  }
];
