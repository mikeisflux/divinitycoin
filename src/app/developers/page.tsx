// app/developers/page.tsx
// Developer documentation page

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function DevelopersPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900">
            Developer <span className="text-primary-600">Documentation</span>
          </h1>
          <p className="mt-6 text-xl text-neutral-600">
            Integrate DivinityCoin into your platform and enable seamless creator payments.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/become-a-partner">
              <Button size="lg">Get API Access</Button>
            </Link>
            <a href="#quickstart">
              <Button variant="outline" size="lg">Quick Start</Button>
            </a>
          </div>
        </div>
      </section>

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
                  Include your API key in all requests using the <code className="bg-neutral-100 px-2 py-1 rounded">Authorization</code> header:
                </p>
                <div className="bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">{`curl -X POST https://api.divinitycoin.com/v1/credits/redeem \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"code": "XXXX-XXXX-XXXX-XXXX", "userId": "user123"}'`}</pre>
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
                  When a user wants to add credits, call the redemption endpoint:
                </p>
                <div className="bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">{`POST /v1/credits/redeem
{
  "code": "XXXX-XXXX-XXXX-XXXX",
  "userId": "your-platform-user-id"
}

Response:
{
  "success": true,
  "amount": 25.00,
  "currency": "USD",
  "newBalance": 50.00
}`}</pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* API Reference */}
      <section className="py-16 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-neutral-900 mb-8">API Reference</h2>

          <div className="space-y-6">
            {/* Redeem Credits */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                  /v1/credits/redeem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600 mb-4">Redeem a DivinityCoin code and add credits to a user&apos;s balance.</p>

                <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                  <pre className="text-sm">{`{
  "code": string,      // Required. The redemption code
  "userId": string,    // Required. Your platform's user ID
  "email": string      // Optional. User's email for matching
}`}</pre>
                </div>

                <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">{`{
  "success": true,
  "amount": 25.00,
  "currency": "USD",
  "newBalance": 75.00,
  "transactionId": "txn_abc123"
}`}</pre>
                </div>
              </CardContent>
            </Card>

            {/* Get Balance */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-mono rounded mr-2">GET</span>
                  /v1/credits/balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600 mb-4">Get a user&apos;s current credit balance.</p>

                <h4 className="font-semibold text-neutral-900 mb-2">Query Parameters</h4>
                <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                  <pre className="text-sm">{`userId: string  // Required. Your platform's user ID`}</pre>
                </div>

                <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">{`{
  "userId": "user123",
  "availableBalance": 50.00,
  "heldBalance": 10.00,
  "currency": "USD"
}`}</pre>
                </div>
              </CardContent>
            </Card>

            {/* Create Hold */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                  /v1/credits/hold
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600 mb-4">Place a hold on credits for a pending pledge or purchase.</p>

                <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                  <pre className="text-sm">{`{
  "userId": string,     // Required. Your platform's user ID
  "amount": number,     // Required. Amount to hold
  "pledgeId": string,   // Required. Your pledge/order ID
  "projectId": string,  // Optional. Related project ID
  "expiresIn": number   // Optional. Hold expiration in seconds
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
                  /v1/credits/capture
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600 mb-4">Capture a previously held amount (e.g., when a project is funded).</p>

                <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                  <pre className="text-sm">{`{
  "holdId": string,  // Required. The hold ID to capture
  "amount": number   // Optional. Partial capture amount
}`}</pre>
                </div>

                <h4 className="font-semibold text-neutral-900 mb-2">Response</h4>
                <div className="bg-neutral-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">{`{
  "success": true,
  "capturedAmount": 25.00,
  "transactionId": "txn_def456"
}`}</pre>
                </div>
              </CardContent>
            </Card>

            {/* Release Hold */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded mr-2">POST</span>
                  /v1/credits/release
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600 mb-4">Release a held amount (e.g., when a project fails or pledge is cancelled).</p>

                <h4 className="font-semibold text-neutral-900 mb-2">Request Body</h4>
                <div className="bg-neutral-100 p-4 rounded-lg mb-4 overflow-x-auto">
                  <pre className="text-sm">{`{
  "holdId": string  // Required. The hold ID to release
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
          </div>
        </div>
      </section>

      {/* Webhooks */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-neutral-900 mb-8">Webhooks</h2>

          <Card className="mb-6">
            <CardContent className="p-6">
              <p className="text-neutral-600 mb-4">
                Configure a webhook URL in your partner dashboard to receive real-time notifications
                about credit events. All webhook payloads are signed using HMAC-SHA256.
              </p>

              <h4 className="font-semibold text-neutral-900 mb-2">Verifying Signatures</h4>
              <div className="bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm">{`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}</pre>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-xl font-semibold text-neutral-900 mb-4">Event Types</h3>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <code className="text-primary-600 font-mono">credit.redeemed</code>
                <p className="text-neutral-600 mt-1">A code was redeemed and credits were added to a user&apos;s balance.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <code className="text-primary-600 font-mono">credit.held</code>
                <p className="text-neutral-600 mt-1">Credits were placed on hold for a pending transaction.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <code className="text-primary-600 font-mono">credit.captured</code>
                <p className="text-neutral-600 mt-1">Held credits were captured and transferred.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <code className="text-primary-600 font-mono">credit.released</code>
                <p className="text-neutral-600 mt-1">Held credits were released back to available balance.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Error Codes */}
      <section className="py-16 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-neutral-900 mb-8">Error Codes</h2>

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
                    <td className="py-3 px-4 font-mono text-sm">invalid_code</td>
                    <td className="py-3 px-4 text-sm">400</td>
                    <td className="py-3 px-4 text-sm text-neutral-600">The provided code is invalid or malformed</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono text-sm">code_already_redeemed</td>
                    <td className="py-3 px-4 text-sm">409</td>
                    <td className="py-3 px-4 text-sm text-neutral-600">This code has already been redeemed</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono text-sm">code_expired</td>
                    <td className="py-3 px-4 text-sm">410</td>
                    <td className="py-3 px-4 text-sm text-neutral-600">The code has expired</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono text-sm">insufficient_balance</td>
                    <td className="py-3 px-4 text-sm">400</td>
                    <td className="py-3 px-4 text-sm text-neutral-600">User does not have enough available credits</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono text-sm">hold_not_found</td>
                    <td className="py-3 px-4 text-sm">404</td>
                    <td className="py-3 px-4 text-sm text-neutral-600">The specified hold was not found</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono text-sm">rate_limit_exceeded</td>
                    <td className="py-3 px-4 text-sm">429</td>
                    <td className="py-3 px-4 text-sm text-neutral-600">Too many requests, please slow down</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono text-sm">unauthorized</td>
                    <td className="py-3 px-4 text-sm">401</td>
                    <td className="py-3 px-4 text-sm text-neutral-600">Invalid or missing API key</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SDKs */}
      <section className="py-16 bg-white">
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
