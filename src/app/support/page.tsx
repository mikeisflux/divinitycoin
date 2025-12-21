// app/support/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function SupportPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-neutral-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl font-bold text-neutral-900">
            How Can We Help?
          </h1>
          <p className="mt-4 text-xl text-neutral-600">
            We're here to assist you with any questions or issues.
          </p>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardContent className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-8 h-8 text-primary-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Email Support
                </h3>
                <p className="text-neutral-600 mb-6">
                  Send us an email and we'll get back to you within 24 hours.
                </p>
                <a href="mailto:support@divinitycoin.com">
                  <Button>support@divinitycoin.com</Button>
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-8 h-8 text-primary-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  FAQ
                </h3>
                <p className="text-neutral-600 mb-6">
                  Find quick answers to common questions in our FAQ section.
                </p>
                <Link href="/faq">
                  <Button variant="outline">View FAQ</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Common Issues */}
      <section className="py-20 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-neutral-900 mb-8 text-center">
            Common Issues
          </h2>

          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-neutral-900 mb-2">
                I didn't receive my code
              </h3>
              <p className="text-neutral-600">
                First, check your spam/junk folder. If you still can't find it,
                email us with your payment confirmation and we'll resend your
                code immediately.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-neutral-900 mb-2">
                My code isn't working
              </h3>
              <p className="text-neutral-600">
                Make sure you're entering the code exactly as shown. Codes are
                case-insensitive but must include all 16 characters. If it still
                doesn't work, contact us.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-neutral-900 mb-2">
                I want a refund
              </h3>
              <p className="text-neutral-600">
                Unredeemed codes can be refunded within 30 days. Email us with
                your order details and we'll process your refund within 5-10
                business days.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-neutral-900 mb-2">
                I was charged twice
              </h3>
              <p className="text-neutral-600">
                Double charges are rare but can happen. Contact us immediately
                with your payment confirmations and we'll investigate and refund
                any duplicate charges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Response Time */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">
            Response Times
          </h2>
          <p className="text-neutral-600 max-w-2xl mx-auto">
            We aim to respond to all support requests within 24 hours during
            business days. For urgent matters related to payments, we prioritize
            faster responses.
          </p>
        </div>
      </section>
    </>
  );
}
