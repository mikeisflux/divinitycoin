// app/redeem/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function RedeemPage() {
  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-neutral-900">
            Redeem Your Credits
          </h1>
          <p className="mt-2 text-neutral-600">
            Choose a partner platform to redeem your credit code.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>

              <h2 className="text-xl font-semibold text-neutral-900 mb-4">
                How to Redeem
              </h2>

              <ol className="text-left space-y-4 mb-8">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </span>
                  <span className="text-neutral-600">
                    Visit your favorite partner platform
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </span>
                  <span className="text-neutral-600">
                    Navigate to their "Add Credits" or "Redeem Code" page
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    3
                  </span>
                  <span className="text-neutral-600">
                    Enter your 16-character credit code
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    4
                  </span>
                  <span className="text-neutral-600">
                    Start supporting creators!
                  </span>
                </li>
              </ol>

              <div className="bg-neutral-100 rounded-lg p-6 mb-8">
                <p className="text-sm text-neutral-600">
                  Your credit code was sent to your email after purchase.
                  <br />
                  Check your inbox or spam folder if you can't find it.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/balance">
                  <Button variant="outline">Check Code Status</Button>
                </Link>
                <Link href="/buy">
                  <Button>Buy More Credits</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Partner Platforms */}
        <div className="mt-12 text-center">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Partner Platforms
          </h3>
          <p className="text-neutral-600 mb-6">
            Your confirmation email includes links to our current partner
            platforms where you can redeem your credits.
          </p>
        </div>

        {/* Help */}
        <p className="mt-8 text-sm text-neutral-500 text-center">
          Having trouble redeeming?{' '}
          <a href="/support" className="text-primary-600 hover:underline">
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}
