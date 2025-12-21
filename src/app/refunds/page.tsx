// app/refunds/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-white py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">
          Refund Policy
        </h1>
        <p className="text-neutral-500 mb-12">Last Updated: January 2025</p>

        <div className="prose prose-neutral max-w-none">
          <h2>Overview</h2>
          <p>
            We want you to be completely satisfied with your CreatorCredits
            purchase. This policy outlines when and how you can request a
            refund.
          </p>

          <h2>Refund Eligibility</h2>
          <div className="not-prose my-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-semibold text-neutral-900">
                    Scenario
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-neutral-900">
                    Eligible?
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-900">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-100">
                  <td className="py-3 px-4">Unredeemed code, within 30 days</td>
                  <td className="py-3 px-4 text-center text-green-600">Yes</td>
                  <td className="py-3 px-4 text-neutral-600">Full refund</td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-3 px-4">Unredeemed code, after 30 days</td>
                  <td className="py-3 px-4 text-center text-yellow-600">
                    Case-by-case
                  </td>
                  <td className="py-3 px-4 text-neutral-600">Contact support</td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-3 px-4">Redeemed code</td>
                  <td className="py-3 px-4 text-center text-red-600">No</td>
                  <td className="py-3 px-4 text-neutral-600">Non-refundable</td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-3 px-4">Technical error (duplicate charge)</td>
                  <td className="py-3 px-4 text-center text-green-600">Yes</td>
                  <td className="py-3 px-4 text-neutral-600">Full refund</td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-3 px-4">Fraudulent purchase</td>
                  <td className="py-3 px-4 text-center text-green-600">Yes</td>
                  <td className="py-3 px-4 text-neutral-600">
                    Full refund, code revoked
                  </td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-3 px-4">Dissatisfaction with partner</td>
                  <td className="py-3 px-4 text-center text-red-600">No</td>
                  <td className="py-3 px-4 text-neutral-600">Contact partner</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>How to Request a Refund</h2>
          <p>To request a refund, email support@creatorcredits.com with:</p>
          <ul>
            <li>Your transaction ID or payment confirmation</li>
            <li>Email address used for purchase</li>
            <li>Reason for refund request</li>
          </ul>
          <p>We typically respond within 24-48 hours.</p>

          <h2>Refund Processing</h2>
          <ul>
            <li>Refunds are processed to your original payment method</li>
            <li>Processing takes 5-10 business days</li>
            <li>You'll receive email confirmation when processed</li>
          </ul>

          <h2>Code Revocation</h2>
          <p>
            When a refund is issued, the associated credit code is immediately
            revoked and cannot be used for redemption.
          </p>

          <h2>Partial Refunds</h2>
          <p>
            Partial refunds may be issued in special circumstances at our
            discretion. Contact support to discuss your situation.
          </p>

          <h2>Disputes</h2>
          <p>
            Please contact us before initiating a chargeback with your bank. We
            can often resolve issues faster through direct communication.
            Chargebacks initiated without contacting us first may result in
            account restrictions.
          </p>

          <h2>Contact</h2>
          <p>
            For refund requests or questions:
            <br />
            Email: support@creatorcredits.com
            <br />
            Response time: 24-48 hours
          </p>
        </div>

        <div className="mt-12 text-center">
          <Link href="/support">
            <Button>Contact Support</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
