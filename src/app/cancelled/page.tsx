// app/cancelled/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function CancelledPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12">
      <div className="max-w-md mx-auto px-4 text-center">
        {/* Cancelled Icon */}
        <div className="w-20 h-20 bg-neutral-200 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-neutral-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-neutral-900 mb-2">
          Checkout Cancelled
        </h1>
        <p className="text-neutral-600 mb-8">
          Your payment was cancelled. No charges have been made to your account.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/buy">
            <Button>Try Again</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>

        <p className="mt-8 text-sm text-neutral-500">
          Having trouble?{' '}
          <Link href="/support" className="text-primary-600 hover:underline">
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  );
}
