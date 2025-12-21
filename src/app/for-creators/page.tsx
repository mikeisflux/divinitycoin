// app/for-creators/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function ForCreatorsPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <span className="inline-block px-4 py-1 bg-primary-500/20 text-primary-300 rounded-full text-sm font-medium mb-6">
            For Platforms & Creators
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            Accept Payments Without the Hassle
          </h1>
          <p className="mt-6 text-xl text-neutral-300 max-w-2xl mx-auto">
            Partner with DivinityCoin to offer your users a flexible payment
            option. No integration headaches. No payment processor restrictions.
          </p>
          <div className="mt-10">
            <a href="mailto:partners@divinitycoin.com">
              <Button
                size="xl"
                className="bg-white text-neutral-900 hover:bg-neutral-100"
              >
                Become a Partner
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-neutral-900">
              Why Partner With Us?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card hover>
              <CardContent className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Expand Payment Options
                </h3>
                <p className="text-neutral-600">
                  Accept credits as payment alongside traditional methods. Give
                  your users more ways to support creators on your platform.
                </p>
              </CardContent>
            </Card>

            <Card hover>
              <CardContent className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-8 h-8 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Simple API Integration
                </h3>
                <p className="text-neutral-600">
                  Our REST API makes integration straightforward. Validate
                  codes, check balances, and process transactions with just a
                  few endpoints.
                </p>
              </CardContent>
            </Card>

            <Card hover>
              <CardContent className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-8 h-8 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Reliable Payouts
                </h3>
                <p className="text-neutral-600">
                  Funds are held securely and transferred to creators on your
                  schedule. You maintain full control over your payout process.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works for Partners */}
      <section className="py-24 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-neutral-900">
              How the Integration Works
            </h2>
          </div>

          <div className="space-y-8">
            {[
              {
                step: 1,
                title: 'Secure API Connection',
                desc: 'We establish a secure connection between your platform and our credit system. All communication is encrypted and authenticated.',
              },
              {
                step: 2,
                title: 'User Redeems Code',
                desc: 'Users enter their DivinityCoin code on your platform. Your backend validates it with our API and adds credits to their account.',
              },
              {
                step: 3,
                title: 'Credits Used on Platform',
                desc: 'Users spend credits on your platform just like any other payment method. Our API handles balance checks and transaction processing.',
              },
              {
                step: 4,
                title: 'Settlement & Payouts',
                desc: 'We settle captured credits with your platform on a regular schedule. You handle creator payouts through your existing systems.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-6">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-neutral-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">
            Interested in Partnering?
          </h2>
          <p className="text-xl text-neutral-600 mb-8 max-w-2xl mx-auto">
            We're selectively onboarding new partner platforms. Reach out to
            discuss how DivinityCoin can work for your platform.
          </p>
          <a href="mailto:partners@divinitycoin.com">
            <Button size="lg">Contact Partnership Team</Button>
          </a>
        </div>
      </section>
    </>
  );
}
