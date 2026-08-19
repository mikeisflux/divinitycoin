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
                      Include your API key in all requests using the <code className="bg-neutral-100 px-2 py-1 rounded">Authorization: Bearer</code> header:
                    </p>
                    <div className="bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-sm">{`curl -X POST "https://divinitycoin.com/internal?action=validate" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
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
                      <pre className="text-sm">{`POST /internal?action=validate
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
   │    (card processed)   │                    │                    │
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
   │                        │                    │  (creator payout)  │
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
                          <td className="py-3 px-4 pl-8 text-neutral-500">└ Card Processing</td>
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
                          <td className="py-3 px-4 font-medium">Payout Processing</td>
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

          {/* API Base URL */}
          <section id="api-base" className="py-16 bg-neutral-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-bold text-neutral-900 mb-8">API Configuration</h2>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Base URL</h3>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-6">
                    <code className="text-primary-600 font-mono">https://divinitycoin.com</code>
                  </div>

                  <h3 className="font-semibold text-lg mb-4">Authentication</h3>
                  <p className="text-neutral-600 mb-4">
                    All API requests require a Bearer token in the Authorization header:
                  </p>
                  <div className="bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`Authorization: Bearer YOUR_API_KEY`}</pre>
                  </div>

                  <h3 className="font-semibold text-lg mt-6 mb-4">Request Format</h3>
                  <p className="text-neutral-600 mb-4">
                    All endpoints use query parameters for the action type:
                  </p>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`POST /internal?action=validate
POST /internal?action=balance
POST /internal?action=hold
POST /internal?action=capture
POST /internal?action=record_capture
POST /internal?action=release
POST /internal?action=create-payment-intent
POST /internal?action=refund
POST /internal?action=verify-payment
POST /internal?action=create-setup-intent
POST /internal?action=get-setup-intent
POST /internal?action=list-payment-methods
POST /internal?action=detach-payment-method
POST /internal?action=charge-saved-payment-method
POST /internal?action=create-checkout-session
POST /internal?action=get-checkout-session
GET  /internal?action=health
GET  /internal?action=settlements
GET  /internal?action=settlement&id=xxx
GET  /internal?action=captures`}</pre>
                  </div>
                </CardContent>
              </Card>
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
                    /internal?action=validate
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
                    /internal?action=balance
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
  "available": 50.00,
  "held": 10.00,
  "total": 60.00,
  "holds": [
    {
      "id": "hold_xyz",
      "amount": 10.00,
      "pledgeId": "pledge123",
      "projectId": "project456",
      "expiresAt": "2025-02-15T00:00:00Z"
    }
  ]
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Create Hold */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=hold
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
                    /internal?action=capture
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">Capture a previously held amount (e.g., when a project is funded).</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "pledgeId": string  // Required. The pledge ID with the hold
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "capturedAmount": 25.00
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Record Capture (for settlements) */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=record_capture
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">Record capture metadata for settlement tracking (call after capturing a hold).</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "holdId": string,        // Required. The hold ID that was captured
  "partnerId": string,     // Required. Your partner ID
  "creatorId": string,     // Required. Creator's ID on your platform
  "creatorEmail": string,  // Optional. Creator's email
  "projectId": string,     // Required. Project ID
  "projectName": string,   // Optional. Project name for reference
  "amount": number         // Required. Amount captured
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "capture": {
    "id": "cap_abc123",
    "holdId": "hold_xyz",
    "amount": 25.00,
    "capturedAt": "2025-01-08T10:00:00Z"
  }
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Release Hold */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=release
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

              {/* Create Payment Intent */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=create-payment-intent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    Create a payment intent for seamless in-platform payment. Returns
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">clientSecret</code>
                    and
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">publishableKey</code>
                    so you can mount the embedded card fields directly on your checkout — no
                    redirect to DivinityCoin required. DC charges immediately and uses
                    credit holds, so there is no setup-intent flow.
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "amount": number,                // Required. Amount in cents (must be > 0)
  "currency": string,              // Optional. Default "usd"
  "platformUserId": string,        // Required. Your platform's user ID
  "email": string,                 // Required. Customer email
  "name": string,                  // Optional. Customer name
  "pledgeId": string,              // Required. Your pledge/order ID
  "projectId": string,             // Required. Project ID
  "statement_descriptor": string,  // Optional. Max 22 chars (suffix on card statement)
  "type": "upcharge",              // Optional. Marks this as a pledge-modification charge
  "originalPaymentId": string      // Optional. Required when type="upcharge"; the
                                   //   paymentIntentId of the original pledge payment
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "clientSecret": "pi_3Abc..._secret_xyz",
  "paymentIntentId": "pi_3Abc...",
  "publishableKey": "pk_live_...",
  "amount": 2500
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Hosted Checkout — intro */}
              <Card>
                <CardHeader>
                  <CardTitle>Hosted Checkout (optional)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-3">
                    An alternative path for partners who want DC to host the
                    card capture surface instead of mounting Stripe Elements on
                    their own checkout. Create a session, redirect the user to
                    the returned <code className="font-mono text-xs bg-neutral-100 px-1 rounded">checkoutUrl</code>,
                    user pays (or saves a card) on a DC-branded page, then DC
                    redirects them back to your <code className="font-mono text-xs bg-neutral-100 px-1 rounded">returnUrl</code>
                    with a <code className="font-mono text-xs bg-neutral-100 px-1 rounded">session_id</code> query param.
                  </p>
                  <p className="text-neutral-600 mb-3">
                    This is fully opt-in and coexists with the direct
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">create-payment-intent</code>
                    flow above — existing integrations are unaffected. Use this
                    when you want SCA / 3DS, card brand UI, and any Stripe
                    Elements branding to live entirely on
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">divinitycoin.com</code>
                    rather than your own page.
                  </p>
                  <p className="text-neutral-600 mb-3">
                    For PAYMENT mode the underlying PaymentIntent is created
                    up-front, so the existing
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">payment.succeeded</code>
                    /
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">payment.failed</code>
                    /
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">payment.requires_action</code>
                    webhooks fire exactly as they do for the direct flow. For
                    SETUP mode, learn the saved
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">paymentMethodId</code>
                    by calling
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">get-checkout-session</code>
                    after the user returns; that id is then valid input for
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">charge-saved-payment-method</code>.
                  </p>
                  <p className="text-neutral-600 mb-3">
                    <strong>Iframe embedding (optional).</strong> Instead of redirecting the user
                    to the <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">checkoutUrl</code>,
                    you can mount it in an iframe on your own page. We have to
                    allowlist your origin via our
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">CHECKOUT_FRAME_ANCESTORS</code>
                    config — send us the origin(s) you want enabled (apex, www,
                    staging, etc.). Once enabled, the iframe streams three
                    postMessages to your page (all share
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">namespace: &quot;divinitycoin-checkout&quot;</code>):
                  </p>
                  <ul className="text-neutral-600 mb-3 ml-6 list-disc text-sm space-y-1">
                    <li><code className="font-mono text-xs">type: &quot;ready&quot;</code> — on initial load, with the <code className="font-mono text-xs">sessionId</code>.</li>
                    <li><code className="font-mono text-xs">type: &quot;resize&quot;</code> — whenever the content height changes, with <code className="font-mono text-xs">height</code> in pixels. Apply it to your iframe&apos;s height for an auto-sized embed.</li>
                    <li><code className="font-mono text-xs">type: &quot;complete&quot;</code> — when the session reaches a terminal state, with <code className="font-mono text-xs">status</code> (complete / failed / expired / canceled), <code className="font-mono text-xs">redirectUrl</code>, and <code className="font-mono text-xs">disableAutoRedirect</code> echoing the session&apos;s setting. By default we also top-nav the browser to <code className="font-mono text-xs">redirectUrl</code> right after the message. To handle navigation yourself instead, pass <code className="font-mono text-xs">disableAutoRedirect: true</code> when creating the session — we&apos;ll then emit the message and stop, leaving navigation entirely to your handler. (Trying to cancel our nav from the message handler is racy because the nav is queued on <code className="font-mono text-xs">window.top</code> at the same instant the message is sent; the session flag is the only clean way to opt out.)</li>
                  </ul>
                  <p className="text-neutral-600 mb-3 text-sm">
                    On mobile WebKit (iOS Safari, iOS Chrome, in-app webviews)
                    3DS challenges and Apple/Google Pay can&apos;t reliably run
                    inside a cross-origin iframe, so on those devices we
                    automatically render a &quot;Continue securely&quot; button
                    that opens the same checkout URL in a top-level popup. The
                    popup completes payment and postMessages the iframe; the
                    iframe also polls a lightweight status endpoint as a
                    backstop. From the partner&apos;s perspective the final
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">complete</code>
                    message and the top-nav to <code className="font-mono text-xs">returnUrl</code>
                    behave identically — no mobile-specific code needed on your side.
                  </p>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`<!-- Minimal partner embed snippet -->
<iframe
  id="dc-checkout"
  src="https://divinitycoin.com/checkout/cs_..."
  style="width: 100%; border: 0; min-height: 480px;"
  allow="payment *; publickey-credentials-get *"
></iframe>
<script>
  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://divinitycoin.com') return;
    const d = e.data;
    if (!d || d.namespace !== 'divinitycoin-checkout') return;
    if (d.type === 'resize') {
      document.getElementById('dc-checkout').style.height = d.height + 'px';
    } else if (d.type === 'complete') {
      // d.status, d.sessionId, d.redirectUrl
      // Default: we'll top-nav to d.redirectUrl right after this message.
      // Override by setting window.location yourself + hiding the iframe.
    }
  });
</script>`}</pre>
                  </div>

                  <p className="text-neutral-600 mb-3">
                    DC also fires dedicated session-level events when a hosted
                    session reaches a terminal state:
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">checkout.completed</code>,
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">checkout.failed</code>,
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">checkout.expired</code>,
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">checkout.canceled</code>.
                    Each event delivers the same envelope as our other
                    webhooks and includes
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">sessionId</code>,
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">mode</code>,
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">paymentIntentId</code>
                    /
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">setupIntentId</code>,
                    and
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">paymentMethodId</code>
                    (on COMPLETE) — particularly useful for SETUP mode where no
                    payment.* event would otherwise fire, and at-most-once on
                    our side so they can be safely combined with the existing
                    payment.* events without double-processing. Subscribe via
                    the partner portal → Settings → Webhooks (or leave your
                    event allowlist empty to receive everything).
                  </p>
                </CardContent>
              </Card>

              {/* Create Checkout Session */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=create-checkout-session
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    Create a hosted checkout session and receive a
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">checkoutUrl</code>
                    to redirect the user to. Session expires after
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">expiresInMinutes</code>
                    (default 30, max 1440).
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body — common fields</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "mode": "payment" | "setup",      // Optional. Default "payment"
  "platformUserId": string,         // Required. Your platform's user ID
  "email": string,                  // Required. Customer email
  "returnUrl": string,              // Required. Absolute URL we redirect to on terminal state
  "cancelUrl": string,              // Optional. Absolute URL for cancel/expired/failed (default: returnUrl)
  "partnerLogoUrl": string,         // Optional. Shown in the hosted page header (defaults to your Partner.logoUrl)
  "description": string,            // Optional. Short blurb shown above the card field
  "expiresInMinutes": number,       // Optional. 1-1440, default 30
  "disableAutoRedirect": boolean    // Optional. Default false. When true, the hosted
                                    //   page emits the "complete" postMessage on
                                    //   terminal state but does NOT top-nav to
                                    //   returnUrl — you handle navigation yourself
                                    //   in the message handler. Useful for iframe
                                    //   embeds that want to transition their own UI
                                    //   in place after completion.
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Additional fields when <code className="font-mono text-xs">mode="payment"</code></h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "amount": number,            // Required. Amount in cents (must be > 0)
  "currency": string,          // Optional. Default "usd"
  "pledgeId": string,          // Required. Your pledge/order ID
  "projectId": string          // Required. Your project ID
}`}</pre>
                  </div>

                  <p className="text-neutral-600 mb-4 text-sm">
                    In <code className="font-mono text-xs">mode="setup"</code> the payment-specific fields above are ignored — DC creates a SetupIntent for the customer that can later be charged off-session via <code className="font-mono text-xs">charge-saved-payment-method</code>.
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "sessionId": "cs_a1b2c3...",
  "checkoutUrl": "https://divinitycoin.com/checkout/cs_a1b2c3...",
  "expiresAt": "2026-05-15T16:30:00.000Z"
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Get Checkout Session */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=get-checkout-session
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    Look up the current state of a hosted checkout session.
                    Self-heals: if our local state is still
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">pending</code>
                    but the underlying PaymentIntent / SetupIntent has moved on
                    at the processor, we refresh from live status before
                    responding. Call this after the user returns to your
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">returnUrl</code>
                    with the <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">session_id</code> query param.
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "sessionId": string          // Required. The cs_... id we returned
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "session": {
    "sessionId": "cs_a1b2c3...",
    "status": "complete",          // pending | complete | failed | expired | canceled
    "mode": "payment",             // payment | setup
    "amount": 2500,                // null in setup mode
    "currency": "usd",
    "pledgeId": "pledge_xyz",      // null in setup mode
    "projectId": "proj_xyz",       // null in setup mode
    "paymentIntentId": "pi_3Abc...", // present in payment mode
    "setupIntentId": null,           // present in setup mode
    "paymentMethodId": "pm_1Xyz...", // present once status=complete
    "platformUserId": "user_xyz",
    "email": "buyer@example.com",
    "expiresAt": "2026-05-15T16:30:00.000Z",
    "completedAt": "2026-05-15T16:14:22.412Z",
    "createdAt": "2026-05-15T16:00:00.000Z"
  }
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Refund */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=refund
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    Refund a partner payment. Full refunds void the gift card, release
                    the hold, deduct from balance, and fire a
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">refund.completed</code>
                    webhook. Partial refunds (pledge modifications) deduct from balance
                    only — the hold and gift card stay active and no webhook is sent.
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "paymentIntentId": string,  // Required (alias: paymentId). The payment intent to refund
  "amount": number,           // Optional. In cents. Defaults to full payment amount
  "reason": string,           // Optional. Free-form reason
  "pledgeId": string,         // Optional. Override the pledge ID for hold release
  "partial": boolean,         // Optional. Default false. true = pledge modification
  "requestedBy": string       // Optional. Audit metadata
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "refundId": "re_3Abc...",
  "amount": 2500,
  "partial": false,
  "status": "succeeded"
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Verify Payment */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=verify-payment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    Server-side confirmation of a payment&apos;s outcome by
                    payment intent ID. Use this after the embedded card fields
                    report success on the client, or to self-heal if a DC
                    webhook is ever missed — it always retrieves the live
                    status from the processor.
                  </p>
                  <p className="text-neutral-600 mb-4">
                    Works even with no local DC record yet (e.g. a saved-card
                    charge that hit 3DS): when there&apos;s no record, the call
                    is authorized via the PaymentIntent&apos;s
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">partnerId</code>
                    metadata instead, and the
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">dcStatus</code>
                    field comes back <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">null</code>.
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "paymentIntentId": string  // Required (alias: paymentId). The payment intent to verify
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "status": "succeeded",     // succeeded | pending | failed
  "amount": 2500,
  "pledgeId": "pledge_abc",
  "projectId": "proj_xyz",
  "platformUserId": "user_123",
  "holdId": "hold_xyz",      // null for saved-card charges
  "dcStatus": "COMPLETED"    // DC's record status, or null if no local record
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Lookup Payment by pledge */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=lookup-payment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    Find every charge attempt recorded against a{' '}
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">pledgeId</code>.
                    Use this when a request timed out and you don&apos;t know
                    whether the card was captured — check here rather than
                    retrying blind. Each attempt is reconciled against the live
                    processor status, so a missed webhook can&apos;t make a
                    settled charge look unpaid.
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "pledgeId": string  // Required. The pledge/charge ID to look up
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "pledgeId": "pledge_abc",
  "hasSuccessfulCharge": true,   // decisive: safe to branch on before retrying
  "attempts": [
    {
      "paymentIntentId": "pi_3Abc...",
      "status": "succeeded",      // live processor status: succeeded | pending | failed
      "dcStatus": "COMPLETED",    // DC's own record status
      "amount": 2500,
      "currency": "usd",
      "projectId": "proj_xyz",
      "platformUserId": "user_123",
      "holdId": null,
      "giftCardId": "gc_abc",
      "refundId": null,
      "refundedAt": null,
      "createdAt": "2026-08-19T14:02:11.000Z",
      "completedAt": "2026-08-19T14:02:13.000Z"
    }
  ]
}`}</pre>
                  </div>
                  <p className="text-neutral-600 mt-4 text-sm">
                    Returns the 10 most recent attempts, newest first. An empty{' '}
                    <code className="font-mono text-xs bg-neutral-100 px-1 rounded">attempts</code>{' '}
                    array with{' '}
                    <code className="font-mono text-xs bg-neutral-100 px-1 rounded">hasSuccessfulCharge: false</code>{' '}
                    means no charge was ever recorded for that pledge — safe to
                    submit one.
                  </p>
                </CardContent>
              </Card>

              {/* Saved-card / off-session flow */}
              <h3 className="text-2xl font-bold text-neutral-900 mt-12 mb-2">Saved Cards & Off-Session Charges</h3>
              <p className="text-neutral-600 mb-6">
                Let users save a card on the partner site and charge it later
                (e.g. when they win an auction) without prompting them again.
                Cards are attached to the DC customer record for that
                <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">platformUserId</code>;
                you only ever store the returned <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">paymentMethodId</code>.
              </p>

              {/* Create Setup Intent */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=create-setup-intent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    Create a setup intent so a user can save a card on
                    file. Returns a <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">clientSecret</code>
                    you confirm client-side with the embedded card fields to
                    collect and store the card. On success the card is attached
                    to the DC customer record for this user and is ready for
                    off-session charges.
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "platformUserId": string,  // Required. Your platform's user ID
  "email": string,           // Required. Customer email
  "name": string             // Optional. Customer name
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "clientSecret": "seti_3Abc..._secret_xyz",
  "setupIntentId": "seti_3Abc...",
  "publishableKey": "pk_live_...",
  "customerId": "cus_..."
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Get Setup Intent */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=get-setup-intent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    Independently confirm a card-save outcome by SetupIntent ID
                    — e.g. after a 3DS redirect, or if you never received the
                    client-side result. Returns the SetupIntent status and, once
                    it has succeeded, the resulting
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">paymentMethodId</code>
                    to store.
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "setupIntentId": string  // Required. The seti_... ID to look up
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "status": "succeeded",   // requires_payment_method | requires_action |
                           //   processing | succeeded | canceled
  "setupIntentId": "seti_3Abc...",
  "paymentMethodId": "pm_1Abc...",  // null until status is "succeeded"
  "platformUserId": "your_user_123",
  "customerId": "cus_..."
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* List Payment Methods */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=list-payment-methods
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    List the cards a user has on file. Use this to render a
                    &quot;Manage payment methods&quot; UI on the partner site.
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "platformUserId": string  // Required. Your platform's user ID
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "paymentMethods": [
    {
      "id": "pm_1Abc...",
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2028,
      "funding": "credit",
      "country": "US",
      "createdAt": "2026-05-01T10:00:00Z"
    }
  ]
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Detach Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=detach-payment-method
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    Remove a saved card. DC verifies the card belongs to the
                    given user before detaching, so calling with a foreign
                    paymentMethodId returns 404.
                  </p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "platformUserId": string,   // Required. Your platform's user ID
  "paymentMethodId": string   // Required. The saved card's payment method ID to remove
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true
}`}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Charge Saved Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                    /internal?action=charge-saved-payment-method
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">
                    Charge a saved card off-session. Use this for things like
                    won-auction billing where the user isn&apos;t actively at
                    the checkout. The PaymentIntent is created and confirmed in
                    one call. Idempotent on
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">pledgeId</code>
                    — retrying the same call returns the same charge.
                  </p>

                  <div className="border-l-4 border-amber-400 bg-amber-50 p-4 rounded mb-4">
                    <p className="font-semibold text-neutral-900 mb-2 text-sm">
                      Retrying a declined charge
                    </p>
                    <p className="text-neutral-700 text-sm mb-2">
                      Idempotency is enforced by Stripe, which caches the result
                      of the first call against a given key for{' '}
                      <strong>24 hours</strong> — and that cache includes
                      failures. A card decline is stored just like a success, so
                      repeating the identical call inside the window replays the
                      cached <code className="font-mono text-xs bg-white px-1 rounded">402</code>{' '}
                      <em>without contacting the bank again</em>.
                    </p>
                    <p className="text-neutral-700 text-sm mb-2">
                      To genuinely re-attempt a declined card, pass a distinct{' '}
                      <code className="font-mono text-xs bg-white px-1 rounded">idempotencyKey</code>{' '}
                      per attempt (e.g.{' '}
                      <code className="font-mono text-xs bg-white px-1 rounded">&quot;attempt-2&quot;</code>).
                      Do <strong>not</strong> mutate{' '}
                      <code className="font-mono text-xs bg-white px-1 rounded">pledgeId</code>{' '}
                      to force a new key — it is stored on the payment record and
                      echoed in webhooks, so changing it breaks your
                      reconciliation.
                    </p>
                    <p className="text-neutral-700 text-sm">
                      Conversely, after a timeout where you don&apos;t know
                      whether the card was captured, retry with the{' '}
                      <em>same</em> parameters and no{' '}
                      <code className="font-mono text-xs bg-white px-1 rounded">idempotencyKey</code>{' '}
                      — within 24 hours you are guaranteed the original
                      PaymentIntent rather than a second charge. Past 24 hours
                      the key expires and a retry <strong>will</strong> charge
                      again; use{' '}
                      <code className="font-mono text-xs bg-white px-1 rounded">action=lookup-payment</code>{' '}
                      to check first.
                    </p>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "platformUserId": string,        // Required. Your platform's user ID
  "paymentMethodId": string,       // Required. The saved card's payment method ID
  "amount": number,                // Required. Amount in cents (must be > 0)
  "currency": string,              // Optional. Default "usd"
  "pledgeId": string,              // Required. Your pledge/charge ID (idempotency key)
  "projectId": string,             // Required. Project / auction ID
  "description": string,           // Optional. Charge description (e.g. "Auction win: Item X")
  "statement_descriptor": string,  // Optional. Max 22 chars (suffix on card statement)
  "idempotencyKey": string         // Optional. 1-64 chars [A-Za-z0-9._:-]. Distinguishes
                                   // retry attempts for the same pledgeId. Omit to reuse
                                   // the cached result; set (e.g. "attempt-2") to force a
                                   // genuine new authorization after a decline.
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response — Success</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": true,
  "status": "succeeded",
  "paymentIntentId": "pi_3Abc...",
  "amount": 5000
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2">Response — Decline / Card Issue (HTTP 402)</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`{
  "success": false,
  "status": "requires_payment_method",
  "error": "Your card was declined.",
  "code": "card_declined",
  "declineCode": "insufficient_funds",
  "paymentIntentId": "pi_3Abc...",
  "clientSecret": "pi_3Abc..._secret_xyz"  // present if user re-auth could recover
}`}</pre>
                  </div>

                  <h4 className="font-semibold text-neutral-900 mb-2 mt-4">Async notification when SCA is required</h4>
                  <p className="text-neutral-600 mb-3 text-sm">
                    If you missed the synchronous
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">requires_action</code>
                    response (server crash, network blip, etc.), DC also fires a
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">payment.requires_action</code>
                    webhook to your endpoint when the PaymentIntent enters that state.
                    Same envelope and signature as other partner webhooks, including
                    the <code className="font-mono text-xs">clientSecret</code> so you
                    can mount Stripe.js with it on your recovery page to let the
                    cardholder complete the challenge.
                  </p>
                  <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">{`// event: "payment.requires_action"
{
  "paymentIntentId": "pi_3Abc...",
  "amount": 5000,
  "platformUserId": "user_xyz",
  "pledgeId": "pledge_xyz",
  "projectId": "proj_xyz",
  "type": "initial" | "upcharge",
  "clientSecret": "pi_3Abc..._secret_xyz",
  "nextActionType": "use_stripe_sdk" | "redirect_to_url" | null
}`}</pre>
                  </div>
                  <p className="text-neutral-600 mt-3 text-sm">
                    Hosted-checkout sessions also produce
                    <code className="font-mono text-xs bg-neutral-100 px-1 mx-1 rounded">payment.requires_action</code>
                    events for their underlying PaymentIntent, but in the hosted
                    flow DC drives the challenge on its own page so the event is
                    informational rather than actionable for your side.
                  </p>
                </CardContent>
              </Card>

              {/* Health Check */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-mono rounded mr-2">GET</span>
                    /internal?action=health
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
                    /internal?action=settlements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">List settlements for your partner account.</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Query Parameters</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`partnerId - Required. Your partner ID
status    - Filter by status (optional)
limit     - Max results (default 20, max 100)
offset    - Pagination offset
from      - Period start after date (ISO)
to        - Period end before date (ISO)`}</pre>
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
                    /internal?action=settlement&amp;partnerId=xxx&amp;id=yyy
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
                    /internal?action=captures
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 mb-4">Query captures (settled or unsettled) for tracking.</p>

                  <h4 className="font-semibold text-neutral-900 mb-2">Query Parameters</h4>
                  <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                    <pre className="text-sm">{`partnerId  - Required. Your partner ID
settled    - Filter by settlement status (boolean)
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

// Signature header for verification (format: t=timestamp,v1=signature)
X-Webhook-Signature: t=1704672000,v1=<hmac-sha256-of-timestamp.body>`}</pre>
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
  // Parse signature header: t=timestamp,v1=signature
  const parts = signature.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const sigPart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !sigPart) return false;

  const timestamp = timestampPart.slice(2);
  const receivedSig = sigPart.slice(3);

  // Verify timestamp is within 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  // Compute expected signature
  const signaturePayload = timestamp + '.' + payload;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(receivedSig),
    Buffer.from(expected)
  );
}

// Usage
app.post('/webhooks/divinitycoin', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const rawBody = JSON.stringify(req.body);

  const isValid = verifyWebhook(
    rawBody,
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
