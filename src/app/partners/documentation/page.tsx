// app/partners/documentation/page.tsx
// Partner API documentation page

'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  auth: string;
  requestBody?: object;
  responseBody?: object;
  example?: {
    request?: string;
    response?: string;
  };
}

interface Section {
  id: string;
  title: string;
  description: string;
  endpoints: Endpoint[];
}

const apiSections: Section[] = [
  {
    id: 'authentication',
    title: 'Authentication',
    description: 'All API requests require authentication via API key or OAuth token.',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/auth/token',
        description: 'Exchange OAuth credentials for an access token',
        auth: 'OAuth Client ID & Secret',
        requestBody: {
          grant_type: 'client_credentials',
          client_id: 'oauth_yourcompany_xxx',
          client_secret: 'your_client_secret',
        },
        responseBody: {
          access_token: 'eyJhbGciOiJIUzI1NiIs...',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      },
    ],
  },
  {
    id: 'gift-cards',
    title: 'Gift Cards',
    description: 'Create, retrieve, and manage gift cards.',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/cards',
        description: 'Create a new gift card',
        auth: 'API Key or Bearer Token',
        requestBody: {
          amount: 5000,
          currency: 'USD',
          recipientEmail: 'recipient@example.com',
          recipientName: 'John Doe',
          message: 'Happy Birthday!',
          design: 'birthday',
          metadata: { order_id: '12345' },
        },
        responseBody: {
          id: 'gc_abc123',
          code: 'XXXX-XXXX-XXXX-XXXX',
          amount: 5000,
          balance: 5000,
          currency: 'USD',
          status: 'active',
          createdAt: '2024-01-15T10:30:00Z',
          expiresAt: '2025-01-15T10:30:00Z',
        },
        example: {
          request: `curl -X POST https://api.creatorcredits.com/api/v1/cards \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 5000, "recipientEmail": "john@example.com"}'`,
          response: `{
  "id": "gc_abc123",
  "code": "XXXX-XXXX-XXXX-XXXX",
  "amount": 5000,
  "balance": 5000,
  "status": "active"
}`,
        },
      },
      {
        method: 'GET',
        path: '/api/v1/cards/:id',
        description: 'Retrieve a gift card by ID',
        auth: 'API Key or Bearer Token',
        responseBody: {
          id: 'gc_abc123',
          code: 'XXXX-XXXX-XXXX-XXXX',
          amount: 5000,
          balance: 3500,
          currency: 'USD',
          status: 'active',
          transactions: [],
        },
      },
      {
        method: 'GET',
        path: '/api/v1/cards/validate/:code',
        description: 'Validate a gift card code and check balance',
        auth: 'Public Key or API Key',
        responseBody: {
          valid: true,
          balance: 3500,
          currency: 'USD',
          expiresAt: '2025-01-15T10:30:00Z',
        },
      },
    ],
  },
  {
    id: 'redemption',
    title: 'Redemption',
    description: 'Redeem gift cards for purchases.',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/cards/:id/redeem',
        description: 'Redeem a gift card (full or partial)',
        auth: 'Private Key or API Key',
        requestBody: {
          amount: 2500,
          orderId: 'order_789',
          description: 'Purchase at Store',
        },
        responseBody: {
          success: true,
          transactionId: 'tx_xyz789',
          amountRedeemed: 2500,
          remainingBalance: 1000,
        },
        example: {
          request: `curl -X POST https://api.creatorcredits.com/api/v1/cards/gc_abc123/redeem \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 2500, "orderId": "order_789"}'`,
          response: `{
  "success": true,
  "transactionId": "tx_xyz789",
  "amountRedeemed": 2500,
  "remainingBalance": 1000
}`,
        },
      },
      {
        method: 'POST',
        path: '/api/v1/cards/:id/refund',
        description: 'Refund a redemption back to the gift card',
        auth: 'Private Key',
        requestBody: {
          transactionId: 'tx_xyz789',
          amount: 2500,
          reason: 'Order cancelled',
        },
        responseBody: {
          success: true,
          refundId: 'ref_abc456',
          newBalance: 3500,
        },
      },
    ],
  },
  {
    id: 'transactions',
    title: 'Transactions',
    description: 'View transaction history.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/transactions',
        description: 'List all transactions for your account',
        auth: 'API Key',
        responseBody: {
          transactions: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 150,
          },
        },
      },
      {
        method: 'GET',
        path: '/api/v1/transactions/:id',
        description: 'Get transaction details',
        auth: 'API Key',
        responseBody: {
          id: 'tx_xyz789',
          type: 'redemption',
          amount: 2500,
          cardId: 'gc_abc123',
          orderId: 'order_789',
          createdAt: '2024-01-15T14:30:00Z',
        },
      },
    ],
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    description: 'Receive real-time notifications for events.',
    endpoints: [
      {
        method: 'POST',
        path: 'Your Webhook URL',
        description: 'We send events to your configured webhook URL',
        auth: 'Webhook Signature',
        requestBody: {
          id: 'evt_123',
          type: 'card.redeemed',
          data: {
            card: { id: 'gc_abc123', balance: 1000 },
            transaction: { id: 'tx_xyz789', amount: 2500 },
          },
          timestamp: '2024-01-15T14:30:00Z',
        },
      },
    ],
  },
];

export default function PartnerDocumentationPage() {
  const [activeSection, setActiveSection] = useState('authentication');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-100 text-blue-700';
      case 'POST': return 'bg-green-100 text-green-700';
      case 'PUT': return 'bg-yellow-100 text-yellow-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-neutral-100 text-neutral-700';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/partners/dashboard" className="text-neutral-500 hover:text-neutral-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">API Documentation</h1>
              <p className="text-sm text-neutral-500">Complete reference for the CreatorCredits API</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-64 flex-shrink-0">
            <div className="sticky top-8 bg-white rounded-xl border border-neutral-200 p-4">
              <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                API Reference
              </h3>
              <ul className="space-y-1">
                {apiSections.map((section) => (
                  <li key={section.id}>
                    <button
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                        activeSection === section.id
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {section.title}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-6 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Base URL
                </h3>
                <code className="text-xs bg-neutral-100 px-2 py-1 rounded text-neutral-700 block">
                  https://api.creatorcredits.com
                </code>
              </div>

              <div className="mt-6 pt-6 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Quick Links
                </h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link href="/partners/api-keys" className="text-primary-600 hover:text-primary-700">
                      Get API Keys
                    </Link>
                  </li>
                  <li>
                    <Link href="/partners/settings" className="text-primary-600 hover:text-primary-700">
                      Configure Webhooks
                    </Link>
                  </li>
                  <li>
                    <Link href="/partners/usage" className="text-primary-600 hover:text-primary-700">
                      View Usage
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 space-y-8">
            {/* Authentication Overview */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Authentication</h2>
              <p className="text-neutral-600 mb-4">
                The CreatorCredits API uses API keys or OAuth 2.0 tokens for authentication.
                Include your credentials in the Authorization header:
              </p>
              <div className="bg-neutral-900 rounded-lg p-4 font-mono text-sm text-white">
                <span className="text-neutral-400">Authorization:</span> Bearer YOUR_API_KEY
              </div>

              <div className="mt-6 grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900">Public Keys (pk_...)</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Read-only access. Safe to use in client-side code.
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900">Private Keys (sk_...)</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Full access. Keep secure on your server only.
                  </p>
                </div>
              </div>
            </div>

            {/* Active Section */}
            {apiSections
              .filter((s) => s.id === activeSection)
              .map((section) => (
                <div key={section.id} className="space-y-6">
                  <div className="bg-white rounded-xl border border-neutral-200 p-6">
                    <h2 className="text-lg font-semibold text-neutral-900 mb-2">{section.title}</h2>
                    <p className="text-neutral-600">{section.description}</p>
                  </div>

                  {section.endpoints.map((endpoint, i) => (
                    <div key={i} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                      {/* Endpoint Header */}
                      <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getMethodColor(endpoint.method)}`}>
                          {endpoint.method}
                        </span>
                        <code className="text-sm font-mono text-neutral-900">{endpoint.path}</code>
                      </div>

                      <div className="p-6 space-y-6">
                        <p className="text-neutral-600">{endpoint.description}</p>

                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-neutral-500">Authentication:</span>
                          <span className="px-2 py-0.5 bg-neutral-100 rounded text-neutral-700 font-mono text-xs">
                            {endpoint.auth}
                          </span>
                        </div>

                        {endpoint.requestBody && (
                          <div>
                            <h4 className="text-sm font-semibold text-neutral-900 mb-2">Request Body</h4>
                            <pre className="bg-neutral-900 rounded-lg p-4 text-sm text-green-400 overflow-x-auto">
                              {JSON.stringify(endpoint.requestBody, null, 2)}
                            </pre>
                          </div>
                        )}

                        {endpoint.responseBody && (
                          <div>
                            <h4 className="text-sm font-semibold text-neutral-900 mb-2">Response</h4>
                            <pre className="bg-neutral-900 rounded-lg p-4 text-sm text-blue-400 overflow-x-auto">
                              {JSON.stringify(endpoint.responseBody, null, 2)}
                            </pre>
                          </div>
                        )}

                        {endpoint.example && (
                          <div>
                            <h4 className="text-sm font-semibold text-neutral-900 mb-2">Example</h4>
                            <div className="relative">
                              <button
                                onClick={() => copyCode(endpoint.example!.request || '', `${section.id}-${i}`)}
                                className="absolute top-2 right-2 px-2 py-1 bg-neutral-700 text-white text-xs rounded hover:bg-neutral-600"
                              >
                                {copiedCode === `${section.id}-${i}` ? 'Copied!' : 'Copy'}
                              </button>
                              <pre className="bg-neutral-900 rounded-lg p-4 text-sm text-white overflow-x-auto">
                                {endpoint.example.request}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            {/* Webhook Verification */}
            {activeSection === 'webhooks' && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="font-semibold text-neutral-900 mb-4">Verifying Webhook Signatures</h3>
                <p className="text-neutral-600 mb-4">
                  All webhook payloads are signed with your webhook secret. Verify signatures to ensure
                  requests are from CreatorCredits:
                </p>
                <pre className="bg-neutral-900 rounded-lg p-4 text-sm text-white overflow-x-auto">
{`const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(\`sha256=\${expectedSignature}\`)
  );
}`}
                </pre>
              </div>
            )}

            {/* Rate Limits */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="font-semibold text-neutral-900 mb-4">Rate Limits</h3>
              <p className="text-neutral-600 mb-4">
                API requests are rate limited based on your plan tier:
              </p>
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-2 text-sm font-medium text-neutral-500">Tier</th>
                    <th className="text-left py-2 text-sm font-medium text-neutral-500">Requests/Minute</th>
                    <th className="text-left py-2 text-sm font-medium text-neutral-500">Burst</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  <tr>
                    <td className="py-3 text-sm text-neutral-900">Standard</td>
                    <td className="py-3 text-sm text-neutral-600">100</td>
                    <td className="py-3 text-sm text-neutral-600">150</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm text-neutral-900">Professional</td>
                    <td className="py-3 text-sm text-neutral-600">500</td>
                    <td className="py-3 text-sm text-neutral-600">750</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm text-neutral-900">Enterprise</td>
                    <td className="py-3 text-sm text-neutral-600">2000</td>
                    <td className="py-3 text-sm text-neutral-600">3000</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-sm text-neutral-500 mt-4">
                Rate limit headers are included in all responses:
                <code className="bg-neutral-100 px-1 rounded">X-RateLimit-Remaining</code>,
                <code className="bg-neutral-100 px-1 rounded">X-RateLimit-Reset</code>
              </p>
            </div>

            {/* Error Codes */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="font-semibold text-neutral-900 mb-4">Error Codes</h3>
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-2 text-sm font-medium text-neutral-500">Code</th>
                    <th className="text-left py-2 text-sm font-medium text-neutral-500">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  <tr>
                    <td className="py-3"><code className="text-sm bg-red-100 text-red-700 px-2 py-0.5 rounded">400</code></td>
                    <td className="py-3 text-sm text-neutral-600">Bad Request - Invalid parameters</td>
                  </tr>
                  <tr>
                    <td className="py-3"><code className="text-sm bg-red-100 text-red-700 px-2 py-0.5 rounded">401</code></td>
                    <td className="py-3 text-sm text-neutral-600">Unauthorized - Invalid or missing API key</td>
                  </tr>
                  <tr>
                    <td className="py-3"><code className="text-sm bg-red-100 text-red-700 px-2 py-0.5 rounded">403</code></td>
                    <td className="py-3 text-sm text-neutral-600">Forbidden - Insufficient permissions</td>
                  </tr>
                  <tr>
                    <td className="py-3"><code className="text-sm bg-red-100 text-red-700 px-2 py-0.5 rounded">404</code></td>
                    <td className="py-3 text-sm text-neutral-600">Not Found - Resource doesn't exist</td>
                  </tr>
                  <tr>
                    <td className="py-3"><code className="text-sm bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">429</code></td>
                    <td className="py-3 text-sm text-neutral-600">Too Many Requests - Rate limit exceeded</td>
                  </tr>
                  <tr>
                    <td className="py-3"><code className="text-sm bg-red-100 text-red-700 px-2 py-0.5 rounded">500</code></td>
                    <td className="py-3 text-sm text-neutral-600">Internal Server Error - Contact support</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
