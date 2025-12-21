// app/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-neutral-900 leading-tight">
                Support Creators.
                <span className="text-primary-600"> Seamlessly.</span>
              </h1>
              <p className="mt-6 text-xl text-neutral-600 leading-relaxed">
                Purchase credits once, use them across our partner platforms. A
                flexible, secure way to back the creators you love.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link href="/buy">
                  <Button size="xl" className="w-full sm:w-auto">
                    Buy Credits
                    <svg
                      className="ml-2 w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </Button>
                </Link>
                <Link href="/how-it-works">
                  <Button size="xl" variant="outline" className="w-full sm:w-auto">
                    How It Works
                  </Button>
                </Link>
              </div>
            </div>

            {/* Hero Illustration */}
            <div className="relative">
              <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-8 transform lg:rotate-2">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm font-medium text-neutral-500">
                    Your Credits
                  </span>
                  <span className="text-sm text-primary-600 font-medium">
                    Active
                  </span>
                </div>
                <div className="text-5xl font-bold text-neutral-900 mb-2">
                  $250.00
                </div>
                <div className="text-neutral-500">Ready to use</div>
                <div className="mt-8 pt-6 border-t border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-primary-600"
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
                    <div>
                      <div className="font-medium text-neutral-900">
                        Instant Delivery
                      </div>
                      <div className="text-sm text-neutral-500">
                        Codes sent immediately
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Background decoration */}
              <div className="absolute -inset-4 bg-gradient-to-r from-primary-200 to-primary-100 rounded-2xl transform -rotate-2 -z-10" />
            </div>
          </div>
        </div>

        {/* Background gradient orbs */}
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-96 h-96 bg-primary-200 rounded-full opacity-30 blur-3xl" />
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-96 h-96 bg-primary-100 rounded-full opacity-40 blur-3xl" />
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900">
              Three Simple Steps
            </h2>
            <p className="mt-4 text-xl text-neutral-600 max-w-2xl mx-auto">
              Get started in minutes. No account required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -left-4 -top-4 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                1
              </div>
              <Card className="pt-8">
                <CardContent>
                  <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
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
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    Choose Amount
                  </h3>
                  <p className="text-neutral-600">
                    Select from preset amounts or enter a custom value. From $5
                    to $500.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -left-4 -top-4 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                2
              </div>
              <Card className="pt-8">
                <CardContent>
                  <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
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
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    Get Your Code
                  </h3>
                  <p className="text-neutral-600">
                    Complete checkout securely with Stripe. Your code arrives
                    instantly via email.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -left-4 -top-4 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                3
              </div>
              <Card className="pt-8">
                <CardContent>
                  <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
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
                        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    Support Creators
                  </h3>
                  <p className="text-neutral-600">
                    Redeem your code on any partner platform and back the
                    projects you love.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900">
                Built for the Creator Economy
              </h2>
              <p className="mt-4 text-xl text-neutral-600">
                We understand creators need flexible funding options. That's why
                we built a universal credit system that works across platforms.
              </p>

              <div className="mt-10 space-y-6">
                {[
                  {
                    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
                    title: 'Secure Payments',
                    description:
                      'All transactions processed through Stripe with bank-level encryption.',
                  },
                  {
                    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
                    title: 'Instant Delivery',
                    description:
                      'Receive your credit code immediately after purchase. No waiting.',
                  },
                  {
                    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                    title: 'Flexible Amounts',
                    description:
                      'Buy exactly what you need, from $5 to $500. Top up anytime.',
                  },
                  {
                    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
                    title: 'No Account Required',
                    description:
                      'Purchase as a guest. Your code is delivered straight to your email.',
                  },
                ].map((feature, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-primary-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={feature.icon}
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900">
                        {feature.title}
                      </h3>
                      <p className="text-neutral-600 mt-1">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-600">$2M+</div>
                  <div className="text-neutral-600 mt-2">Credits Purchased</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-600">50K+</div>
                  <div className="text-neutral-600 mt-2">Happy Supporters</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-600">99.9%</div>
                  <div className="text-neutral-600 mt-2">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-600">
                    &lt;1min
                  </div>
                  <div className="text-neutral-600 mt-2">Avg. Delivery</div>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-neutral-100">
                <div className="flex items-center justify-center gap-4 text-neutral-400">
                  <span className="text-sm">Secured by</span>
                  <span className="text-lg font-bold text-[#635BFF]">stripe</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partner CTA Section */}
      <section className="py-24 bg-neutral-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Want to Accept DivinityCoin on Your Platform?
          </h2>
          <p className="mt-4 text-xl text-neutral-300">
            Partner with us and offer your users a new way to fund creators and projects.
          </p>
          <div className="mt-10">
            <Link href="/become-a-partner">
              <Button
                size="xl"
                className="bg-primary-600 text-white hover:bg-primary-700"
              >
                Become a Partner
                <svg
                  className="ml-2 w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to Support Your Favorite Creators?
          </h2>
          <p className="mt-4 text-xl text-primary-100">
            Get your credits in under a minute. No account required.
          </p>
          <div className="mt-10">
            <Link href="/buy">
              <Button
                size="xl"
                className="bg-white text-primary-600 hover:bg-primary-50"
              >
                Buy Credits Now
                <svg
                  className="ml-2 w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
