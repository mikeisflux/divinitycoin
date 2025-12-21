// app/success/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12">
      <div className="max-w-md mx-auto px-4 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-neutral-900 mb-2">
          Payment Successful!
        </h1>
        <p className="text-neutral-600 mb-8">
          Your credit code has been sent to your email. Check your inbox (and
          spam folder, just in case).
        </p>

        {/* Next Steps */}
        <div className="bg-white rounded-xl p-6 shadow-md text-left mb-8">
          <h2 className="font-semibold text-neutral-900 mb-4">What's Next?</h2>
          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">
                1
              </span>
              <span className="text-neutral-600">
                Check your email for the credit code
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </span>
              <span className="text-neutral-600">
                Go to your favorite creator platform
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </span>
              <span className="text-neutral-600">
                Redeem your code and start supporting!
              </span>
            </li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/buy">
            <Button variant="outline">Buy More Credits</Button>
          </Link>
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
