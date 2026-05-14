// app/faq/page.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

const faqs = [
  {
    category: 'Purchasing',
    questions: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover) through our secure checkout.',
      },
      {
        q: 'Is there a minimum or maximum purchase amount?',
        a: "You can purchase anywhere from $5 to $500 in credits per transaction. There's no limit on how many transactions you can make.",
      },
      {
        q: 'Do I need an account to buy credits?',
        a: "No account is required. Simply enter your email address, and we'll send your credit code directly to your inbox.",
      },
      {
        q: 'How quickly will I receive my code?',
        a: "Credit codes are delivered instantly via email after successful payment. If you don't see it within a few minutes, check your spam folder.",
      },
    ],
  },
  {
    category: 'Using Credits',
    questions: [
      {
        q: 'Where can I use my credits?',
        a: "Credits can be redeemed on our partner platforms. You'll find redemption instructions in your confirmation email.",
      },
      {
        q: 'Do credits expire?',
        a: 'No, credits do not expire. Once purchased, they remain valid until you redeem them.',
      },
      {
        q: 'Can I use credits across multiple platforms?',
        a: 'Each credit code can only be redeemed once on one platform. However, you can purchase multiple codes for different platforms.',
      },
      {
        q: 'What happens to my credits if a project I backed fails?',
        a: "If you back a crowdfunding project that doesn't reach its goal, your credits are returned to your balance on that platform.",
      },
    ],
  },
  {
    category: 'Refunds & Support',
    questions: [
      {
        q: 'Can I get a refund?',
        a: 'Yes! Unredeemed credits can be refunded within 30 days of purchase. Sign in to your account and go to "Request Refund" to submit your request instantly. We only offer full refunds - partial refunds are not available.',
      },
      {
        q: 'What if my code was already redeemed?',
        a: 'If you redeemed your code on a partner platform, a refund is only possible if you have not spent any of the balance. We will coordinate with the partner to verify the full balance is available before processing your refund.',
      },
      {
        q: 'What if I never received my code?',
        a: "First, check your spam folder. If you still can't find it, contact support with your payment confirmation, and we'll resend it.",
      },
      {
        q: "My code isn't working. What should I do?",
        a: "Make sure you're entering the code exactly as shown (codes are case-insensitive). If it still doesn't work, contact our support team.",
      },
      {
        q: 'How do I contact support?',
        a: 'Email us at support@divinitycoin.com. We typically respond within 24 hours.',
      },
    ],
  },
  {
    category: 'Security',
    questions: [
      {
        q: 'Is my payment information secure?',
        a: 'Absolutely. All payments are processed through a PCI-DSS Level 1 certified payment processor. We never see or store your card details.',
      },
      {
        q: 'Should I share my credit code?',
        a: 'Treat your credit code like cash. Anyone with the code can redeem it. Only share it if you intend to gift it to someone.',
      },
      {
        q: 'What if someone steals my code?',
        a: 'If your code is stolen before redemption, contact us immediately. Once redeemed, credits cannot be recovered.',
      },
    ],
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  const toggleQuestion = (id: string) => {
    setOpenIndex(openIndex === id ? null : id);
  };

  return (
    <>
      {/* Hero */}
      <section className="bg-neutral-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl font-bold text-neutral-900">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-xl text-neutral-600">
            Everything you need to know about DivinityCoin.
          </p>
        </div>
      </section>

      {/* FAQ Sections */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {faqs.map((section, sectionIndex) => (
            <div key={sectionIndex} className="mb-12">
              <h2 className="text-xl font-bold text-neutral-900 mb-6">
                {section.category}
              </h2>
              <div className="space-y-4">
                {section.questions.map((item, questionIndex) => {
                  const id = `${sectionIndex}-${questionIndex}`;
                  const isOpen = openIndex === id;

                  return (
                    <div
                      key={id}
                      className="border border-neutral-200 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleQuestion(id)}
                        className="w-full flex items-center justify-between p-4 text-left bg-white hover:bg-neutral-50 transition-colors"
                      >
                        <span className="font-medium text-neutral-900">
                          {item.q}
                        </span>
                        <svg
                          className={`w-5 h-5 text-neutral-500 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 text-neutral-600">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Still Have Questions */}
      <section className="py-20 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">
            Still Have Questions?
          </h2>
          <p className="text-neutral-600 mb-8">
            Can't find what you're looking for? Our support team is here to
            help.
          </p>
          <Link href="/support">
            <Button>Contact Support</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
