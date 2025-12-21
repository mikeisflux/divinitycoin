// app/developers/page.tsx
// Developer documentation page with Settlement & Payout integration guide
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { InteractiveChecklist, settlementChecklistData } from '@/components/checklist/InteractiveChecklist';

type TabId = 'overview' | 'api' | 'settlements' | 'checklist';

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  // Handle URL hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['overview', 'api', 'settlements', 'checklist'].includes(hash)) {
        setActiveTab(hash as TabId);
      }
    };

    // Check hash on initial load
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update URL hash when tab changes
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    window.history.replaceState(null, '', `#${tabId}`);
  };

  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900">
            Developer <span className="text-primary-600">Documentation</span>
          </h1>
          <p className="mt-6 text-xl text-neutral-600 max-w-3xl mx-auto">
            Integrate DivinityCoin into your platform. Complete settlement system,
            creator payouts, and real-time webhooks.
          </p>
          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            <Link href="/become-a-partner">
              <Button size="lg">Get API Access</Button>
            </Link>
            <button onClick={() => handleTabChange('checklist')}>
              <Button variant="outline" size="lg">
                Integration Checklist ({Math.round((progress.completed / Math.max(progress.total, 1)) * 100)}%)
              </Button>
            </button>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <section className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'api', label: 'API Reference' },
              { id: 'settlements', label: 'Settlements & Payouts' },
              { id: 'checklist', label: 'Integration Checklist' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as TabId)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Quick Start */}
          <section id="quickstart" className="py-16 bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-bold text-neutral-900 mb-8">Quick Start</h2>

              <div className="space-y-8">
                {/* Step 1 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">1</span>
                      Get Your API Credentials
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-neutral-600 mb-4">
                      Apply to become a partner and receive your API key. Once approved, you&apos;ll get access to:
                    </p>
                    <ul className="list-disc list-inside text-neutral-600 space-y-1">
                      <li>Production API key</li>
                      <li>Sandbox API key for testing</li>
                      <li>Webhook secret for event verification</li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Step 2 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">2</span>
                      Configure Authentication
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-neutral-600 mb-4">
                      Include your API key in all requests using the <code className="bg-neutral-100 px-2 py-1 rounded">X-Internal-Key</code> header:
                    </p>
                    <div className="bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-sm">{`curl -X POST https://api.divinitycoin.com/internal/validate \\
  -H "X-Internal-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"code": "XXXX-XXXX-XXXX-XXXX", "platformUserId": "user123"}'`}</pre>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 3 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">3</span>
                      Implement Credit Redemption
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-neutral-600 mb-4">
                      When a user wants to add credits, call the validation endpoint:
                    </p>
                    <div className="bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-sm">{`POST /internal/validate
{
  "code": "XXXX-XXXX-XXXX-XXXX",
  "platformUserId": "your-platform-user-id"
}

Response:
{
  "success": true,
  "amount": 25.00,
  "newBalance": 50.00
}`}</pre>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Money Flow Diagram */}
          <section className="py-16 bg-neutral-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-bold text-neutral-900 mb-8">Complete Money Flow</h2>
              <Card>
                <CardContent className="p-6">
                  <div className="bg-neutral-900 text-neutral-100 p-6 rounded-lg overflow-x-auto font-mono text-xs leading-relaxed">
                    <pre>{`  USER                DIVINITYCOIN           PARTNER              CREATOR
   │                        │                    │                    │
   │  1. Buys $100 credits  │                    │                    │
   │───────────────────────►│                    │                    │
   │                        │                    │                    │
   │   (Stripe processes)   │                    │                    │
   │                        │  Funds held        │                    │
   │                        │                    │                    │
   │  2. Redeems code       │                    │                    │
   │────────────────────────┼───────────────────►│                    │
   │                        │   (validates)      │                    │
   │                        │◄──────────────────►│                    │
   │                        │                    │                    │
   │  3. Backs project      │                    │                    │
   │────────────────────────┼───────────────────►│                    │
   │                        │   (hold placed)    │                    │
   │                        │◄──────────────────►│                    │
   │                        │                    │                    │
   │                        │                    │  4. Project funds  │
   │                        │   (capture hold)   │                    │
   │                        │◄──────────────────►│                    │
   │                        │                    │  Creator earned    │
   │                        │                    │  $100 in credits   │
   │                        │                    │──────────────────►│
   │                        │                    │                    │
   │                        │  5. Settlement     │                    │
   │                        │  (weekly/monthly)  │                    │
   │                        │───────────────────►│                    │
   │                        │  Wire $94 (net)    │                    │
   │                        │  (after 6% fee)    │                    │
   │                        │                    │                    │
   │                        │                    │  6. Creator payout │
   │                        │                    │  (Stripe Connect)  │
   │                        │                    │───────────────────►│
   │                        │                    │  $89.30            │
   │                        │                    │  (after 5% fee)    │`}</pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Fee Structure */}
          <section className="py-16 bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-bold text-neutral-900 mb-8">Fee Structure</h2>
              <Card>
                <CardContent className="p-6">
                  <p className="text-neutral-600 mb-6">
                    DivinityCoin charges a <strong>6% total partner fee</strong> on all settled credits.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200">
                          <th className="text-left py-3 px-4 font-medium text-neutral-500">Stage</th>
                          <th className="text-left py-3 px-4 font-medium text-neutral-500">Fee</th>
                          <th className="text-left py-3 px-4 font-medium text-neutral-500">Who Pays</th>
                          <th className="text-left py-3 px-4 font-medium text-neutral-500">Example ($100)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        <tr className="bg-primary-50">
                          <td className="py-3 px-4 font-semibold">Total Partner Fee</td>
                          <td className="py-3 px-4 font-semibold">6%</td>
                          <td className="py-3 px-4">Partner</td>
                          <td className="py-3 px-4 font-semibold">$6.00</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 pl-8 text-neutral-500">└ Stripe Processing</td>
                          <td className="py-3 px-4 text-neutral-500">~2.9% + $0.30</td>
                          <td className="py-3 px-4 text-neutral-500">(included)</td>
                          <td className="py-3 px-4 text-neutral-500">~$3.20</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 pl-8 text-neutral-500">└ Platform Fee</td>
                          <td className="py-3 px-4 text-neutral-500">~2.8%</td>
                          <td className="py-3 px-4 text-neutral-500">(included)</td>
                          <td className="py-3 px-4 text-neutral-500">~$2.80</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-medium">Partner Platform Fee</td>
                          <td className="py-3 px-4">5% of earnings</td>
                          <td className="py-3 px-4">Creator</td>
                          <td className="py-3 px-4">$94 × 5% = $4.70</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-medium">Stripe Connect Payout</td>
                          <td className="py-3 px-4">~0.25%</td>
                          <td className="py-3 px-4">Creator</td>
                          <td className="py-3 px-4">~$0.25</td>
                        </tr>
                        <tr className="bg-green-50">
                          <td className="py-3 px-4 font-bold">Creator Receives</td>
                          <td className="py-3 px-4"></td>
                          <td className="py-3 px-4"></td>
                          <td className="py-3 px-4 font-bold text-green-700">~$89.05</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* SDKs */}
          <section id="sdks" className="py-16 bg-neutral-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-bold text-neutral-900 mb-8">SDKs & Libraries</h2>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <span className="text-yellow-800 font-bold">JS</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">JavaScript / Node.js</h3>
                        <code className="text-sm text-neutral-500">npm install @divinitycoin/sdk</code>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600">
                      Full-featured SDK for Node.js and browser environments.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-800 font-bold">PY</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">Python</h3>
                        <code className="text-sm text-neutral-500">pip install divinitycoin</code>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600">
                      Python SDK with async support for Django, FastAPI, and more.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-purple-800 font-bold">PHP</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">PHP</h3>
                        <code className="text-sm text-neutral-500">composer require divinitycoin/sdk</code>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600">
                      PHP SDK for Laravel, WordPress, and other PHP frameworks.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <span className="text-red-800 font-bold">RB</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">Ruby</h3>
                        <code className="text-sm text-neutral-500">gem install divinitycoin</code>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600">
                      Ruby gem for Rails and Sinatra applications.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <p className="mt-6 text-neutral-600 text-center">
                Don&apos;t see your language?{' '}
                <a href="mailto:developers@divinitycoin.com" className="text-primary-600 hover:underline">
                  Let us know
                </a>{' '}
                and we&apos;ll prioritize it.
              </p>
            </div>
          </section>
        </>
      )}

      {/* API Reference Tab */}
      {activeTab === 'api' && (
        <section id="api" className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-neutral-900 mb-8">API Reference</h2>

            <div className="space-y-6">
              {/* Validate/Redeem */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal/validate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">Validate and redeem a DivinityCoin code, adding credits to a user&apos;s balance.</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "code": string,           // Required. The 16-character redemption code
  "platformUserId": string  // Required. Your platform's user ID
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "amount": 25.00,
  "newBalance": 75.00
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Get Balance */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal/balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">Get a user&apos;s current credit balance.</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "platformUserId": string  // Required. Your platform's user ID
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "platformUserId": "user123",
  "availableBalance": 50.00,
  "heldBalance": 10.00
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Create Hold */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal/hold
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">Place a hold on credits for a pending pledge or purchase.</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "platformUserId": string, // Required. Your platform's user ID
  "amount": number,         // Required. Amount to hold
  "pledgeId": string,       // Required. Your pledge/order ID
  "projectId": string,      // Optional. Related project ID
  "expiresAt": string       // Optional. ISO date for hold expiration
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "holdId": "hold_xyz789",
  "amount": 25.00,
  "expiresAt": "2024-02-15T00:00:00Z"
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Capture Hold */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal/capture
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">Capture a previously held amount (e.g., when a project is funded).</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "pledgeId": string,       // Required. The pledge ID with the hold
  "creatorId": string,      // Required. Creator's ID on your platform
  "creatorEmail": string,   // Optional. Creator's email
  "projectId": string,      // Optional. Project ID
  "projectName": string     // Optional. Project name for reference
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "capturedAmount": 25.00,
  "captureId": "cap_abc123"
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Release Hold */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal/release
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">Release a held amount (e.g., when a project fails or pledge is cancelled).</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "pledgeId": string  // Required. The pledge ID to release the hold for
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "releasedAmount": 25.00,
  "newAvailableBalance": 75.00
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Health Check */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-mono rounded mr-2">GET</span>
                    /internal/health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">Health check endpoint to verify API connectivity.</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "status": "ok",
  "timestamp": "2025-01-08T10:00:00Z"
}`}</pre>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Error Codes */}
            <h2 className="text-3xl font-bold text-neutral-900 mb-8 mt-16">Error Codes</h2>

            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">Code</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    <tr>
                      <td className="py-3 px-4 font-mono text-sm">INVALID_CODE_FORMAT</td>
                      <td className="py-3 px-4 text-sm">400</td>
                      <td className="py-3 px-4 text-sm text-neutral-600">Code is not 16 hex characters</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono text-sm">CODE_NOT_FOUND</td>
                      <td className="py-3 px-4 text-sm">404</td>
                      <td className="py-3 px-4 text-sm text-neutral-600">No gift card matches this code</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono text-sm">ALREADY_REDEEMED</td>
                      <td className="py-3 px-4 text-sm">409</td>
                      <td className="py-3 px-4 text-sm text-neutral-600">Code has already been used</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono text-sm">CODE_EXPIRED</td>
                      <td className="py-3 px-4 text-sm">410</td>
                      <td className="py-3 px-4 text-sm text-neutral-600">Code is past expiration date</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono text-sm">CODE_REVOKED</td>
                      <td className="py-3 px-4 text-sm">410</td>
                      <td className="py-3 px-4 text-sm text-neutral-600">Code was manually revoked</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono text-sm">RATE_LIMITED</td>
                      <td className="py-3 px-4 text-sm">429</td>
                      <td className="py-3 px-4 text-sm text-neutral-600">Too many redemption attempts</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono text-sm">INSUFFICIENT_BALANCE</td>
                      <td className="py-3 px-4 text-sm">400</td>
                      <td className="py-3 px-4 text-sm text-neutral-600">Not enough credits for operation</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono text-sm">HOLD_NOT_FOUND</td>
                      <td className="py-3 px-4 text-sm">404</td>
                      <td className="py-3 px-4 text-sm text-neutral-600">No hold exists for this pledge</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono text-sm">HOLD_NOT_ACTIVE</td>
                      <td className="py-3 px-4 text-sm">400</td>
                      <td className="py-3 px-4 text-sm text-neutral-600">Hold is not in active state</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono text-sm">INVALID_AMOUNT</td>
                      <td className="py-3 px-4 text-sm">400</td>
                      <td className="py-3 px-4 text-sm text-neutral-600">Amount outside allowed range</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Settlements Tab */}
      {activeTab === 'settlements' && (
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-neutral-900 mb-8">Settlements & Payouts</h2>

            <div className="space-y-8">
              {/* Settlement Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Settlement Process</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    DivinityCoin automatically generates settlements based on your configured frequency.
                    Settlements include all captured credits from the period.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-neutral-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Settlement Frequencies</h4>
                      <ul className="text-sm text-neutral-600 space-y-1">
                        <li>Daily - Every day at 00:00 UTC</li>
                        <li>Weekly - Every Monday at 00:00 UTC</li>
                        <li>Biweekly - Every other Monday</li>
                        <li>Monthly - 1st of month at 00:00 UTC</li>
                      </ul>
                    </div>
                    <div className="bg-neutral-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Settlement Statuses</h4>
                      <ul className="text-sm text-neutral-600 space-y-1">
                        <li><span className="text-yellow-600">PENDING</span> - Awaiting approval</li>
                        <li><span className="text-blue-600">APPROVED</span> - Ready for payment</li>
                        <li><span className="text-purple-600">PROCESSING</span> - Payment initiated</li>
                        <li><span className="text-green-600">PAID</span> - Payment confirmed</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Settlement API Endpoints */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-mono rounded mr-2">GET</span>
                    /internal/settlements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">List settlements for your partner account.</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Query Parameters</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`status   - Filter by status (optional)
limit    - Max results (default 20, max 100)
offset   - Pagination offset
from     - Period start after date (ISO)
to       - Period end before date (ISO)`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "settlements": [
    {
      "id": "settle_abc123",
      "periodStart": "2025-01-01T00:00:00Z",
      "periodEnd": "2025-01-07T23:59:59Z",
      "grossAmount": 10000.00,
      "partnerFee": 600.00,
      "netAmount": 9400.00,
      "currency": "USD",
      "captureCount": 47,
      "status": "PAID",
      "paidAt": "2025-01-10T14:30:00Z",
      "paymentRef": "WIRE-20250108-001"
    }
  ],
  "pagination": { "total": 52, "limit": 10, "offset": 0 }
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-mono rounded mr-2">GET</span>
                    /internal/settlements/:id
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">Get detailed settlement with capture breakdown.</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "settlement": {
    "id": "settle_abc123",
    "periodStart": "2025-01-01T00:00:00Z",
    "periodEnd": "2025-01-07T23:59:59Z",
    "grossAmount": 10000.00,
    "partnerFee": 600.00,
    "netAmount": 9400.00,
    "status": "PAID"
  },
  "captures": [
    {
      "id": "cap_001",
      "creatorId": "creator_123",
      "projectId": "project_456",
      "amount": 500.00,
      "capturedAt": "2025-01-02T10:30:00Z"
    }
  ],
  "summary": {
    "byCreator": [
      { "creatorId": "creator_123", "amount": 2500.00, "count": 5 }
    ],
    "byProject": [
      { "projectId": "project_456", "amount": 1500.00, "count": 3 }
    ]
  }
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-mono rounded mr-2">GET</span>
                    /internal/captures
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">Query captures (settled or unsettled) for tracking.</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Query Parameters</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`settled    - Filter by settlement status (boolean)
creatorId  - Filter by creator
projectId  - Filter by project
from       - Captured after date (ISO)
to         - Captured before date (ISO)`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "captures": [
    {
      "id": "cap_xyz",
      "holdId": "hold_123",
      "creatorId": "creator_123",
      "projectId": "project_456",
      "amount": 500.00,
      "capturedAt": "2025-01-08T10:00:00Z",
      "settlementId": null
    }
  ],
  "summary": {
    "totalUnsettled": 2500.00,
    "captureCount": 12
  }
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Webhooks */}
              <h3 className="text-2xl font-bold text-neutral-900 mt-12 mb-6">Settlement Webhooks</h3>

              <Card>
                <CardContent className="p-6">
                  <p className="text-neutral-600 mb-4">
                    Subscribe to settlement events via webhooks. Configure your webhook URL in the partner dashboard.
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Webhook Payload</h4>
                  <div className="bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto mb-6">
                    <pre className="text-sm">{`{
  "event": "settlement.paid",
  "timestamp": "2025-01-10T14:30:00Z",
  "data": {
    "settlementId": "settle_abc123",
    "partnerId": "partner_xyz",
    "periodStart": "2025-01-01T00:00:00Z",
    "periodEnd": "2025-01-07T23:59:59Z",
    "grossAmount": 10000.00,
    "partnerFee": 600.00,
    "netAmount": 9400.00,
    "captureCount": 47,
    "currency": "USD",
    "status": "PAID",
    "paymentRef": "WIRE-20250108-001"
  }
}

// Signature header for verification
X-Webhook-Signature: sha256=<hmac-sha256-of-body-with-secret>`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-3">Settlement Events</h4>
                  <div className="grid gap-2">
                    {[
                      { event: 'settlement.created', desc: 'New settlement generated' },
                      { event: 'settlement.approved', desc: 'Settlement approved for payment' },
                      { event: 'settlement.processing', desc: 'Payment initiated' },
                      { event: 'settlement.paid', desc: 'Payment confirmed' },
                      { event: 'settlement.failed', desc: 'Payment failed' },
                    ].map(({ event, desc }) => (
                      <div key={event} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                        <code className="text-primary-600 font-mono text-sm">{event}</code>
                        <span className="text-neutral-600 text-sm">{desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Signature Verification */}
              <Card>
                <CardHeader>
                  <CardTitle>Verifying Webhook Signatures</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expected)
  );
}

// Usage
app.post('/webhooks/divinitycoin', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = verifyWebhook(
    JSON.stringify(req.body),
    signature,
    process.env.DIVINITYCOIN_WEBHOOK_SECRET
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Process the event
  const { event, data } = req.body;

  switch (event) {
    case 'settlement.paid':
      // Update creator balances, send notifications, etc.
      handleSettlementPaid(data);
      break;
  }

  res.status(200).send('OK');
});`}</pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Checklist Tab */}
      {activeTab === 'checklist' && (
        <section className="py-12 bg-neutral-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-neutral-900">Integration Checklist</h2>
              <p className="mt-2 text-neutral-600">
                Complete implementation guide for the DivinityCoin settlement and payout system.
                Your progress is saved automatically in your browser.
              </p>
            </div>

            <InteractiveChecklist
              sections={settlementChecklistData}
              storageKey="divinitycoin-settlement-checklist"
              onProgressChange={(completed, total) => setProgress({ completed, total })}
            />
          </div>
        </section>
      )}

      {/* Support CTA */}
      <section className="py-16 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Need Help?</h2>
          <p className="text-primary-100 mb-8 text-lg">
            Our developer support team is here to help you integrate DivinityCoin.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a href="mailto:developers@divinitycoin.com">
              <Button variant="secondary" size="lg">
                Email Support
              </Button>
            </a>
            <Link href="/become-a-partner">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
                Become a Partner
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
