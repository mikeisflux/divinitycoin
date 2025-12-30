// app/how-it-works/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-50 to-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900">
            How DivinityCoin Works
          </h1>
          <p className="mt-4 text-xl text-neutral-600">
            A simple, flexible way to support creators across the web.
          </p>
        </div>
      </section>

      {/* Detailed Steps */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="space-y-16">
            {/* Step 1 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0 w-24 h-24 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold">
                1
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 mb-3">
                  Purchase Credits
                </h2>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  Choose any amount between $5 and $500. We accept all major
                  credit and debit cards through our secure Stripe checkout. No
                  account needed—just enter your email and complete the
                  purchase.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0 w-24 h-24 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold">
                2
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 mb-3">
                  Receive Your Code
                </h2>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  Immediately after purchase, you'll receive an email containing
                  your unique 16-character credit code. This code represents
                  your purchased credits and can only be used once. Keep it
                  safe!
                </p>
                <div className="mt-4 bg-neutral-100 rounded-lg p-4 font-mono text-center text-xl tracking-wider">
                  XXXX-XXXX-XXXX-XXXX
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0 w-24 h-24 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold">
                3
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 mb-3">
                  Redeem on Partner Platforms
                </h2>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  Visit any of our partner platforms and navigate to their
                  "Redeem Credits" page. Enter your code, and the credits will
                  be added to your account instantly. Use them to back projects,
                  support creators, or unlock content.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0 w-24 h-24 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold">
                4
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 mb-3">
                  Support Creators
                </h2>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  Your credits are now ready to use! Back crowdfunding
                  campaigns, subscribe to creators, or make purchases. Your
                  support goes directly to the creators you care about.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="py-20 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-neutral-900 text-center mb-12">
            Common Questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'Do credits expire?',
                a: 'Credits do not expire. Once purchased, they remain valid until redeemed.',
              },
              {
                q: 'Can I get a refund?',
                a: 'Yes! Unused credits can be refunded within 30 days of purchase. Sign in to your account and visit the Request Refund page to submit a refund request instantly.',
              },
              {
                q: 'What platforms accept DivinityCoin?',
                a: "We partner with select creator platforms. After purchase, you'll see redemption instructions in your confirmation email.",
              },
              {
                q: 'Is my payment secure?',
                a: 'Absolutely. All payments are processed through Stripe, a PCI-compliant payment processor used by millions of businesses.',
              },
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-neutral-900 mb-2">
                  {item.q}
                </h3>
                <p className="text-neutral-600">{item.a}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/faq">
              <Button variant="outline">View All FAQs</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-primary-100 text-lg mb-8">
            Purchase your credits now and start supporting creators today.
          </p>
          <Link href="/buy">
            <Button
              size="lg"
              className="bg-white text-primary-600 hover:bg-primary-50"
            >
              Buy Credits
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
