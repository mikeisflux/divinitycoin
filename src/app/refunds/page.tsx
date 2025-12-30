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
        <p className="text-neutral-500 mb-12">Last Updated: December 2024</p>

        <div className="prose prose-neutral max-w-none">
          <h2>Overview</h2>
          <p>
            <strong>DVCKS1 LLC, doing business as DivinityCoin</strong>, wants you
            to be completely satisfied with your purchase. This policy outlines
            when and how you can request a refund for DivinityCoin credits.
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
                  <td className="py-3 px-4 text-neutral-600">Non-refundable (value transferred)</td>
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
                  <td className="py-3 px-4">Dissatisfaction with partner platform</td>
                  <td className="py-3 px-4 text-center text-red-600">No</td>
                  <td className="py-3 px-4 text-neutral-600">Contact partner directly</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Important Notes</h2>
          <ul>
            <li>
              In accordance with Indiana Code § 24-4-8 (Indiana Gift Card Act),
              DivinityCoin credits do not expire and are not subject to inactivity
              or dormancy fees.
            </li>
            <li>
              Once a code has been redeemed on a partner platform, the value has
              been transferred and is no longer under our control. Redeemed credits
              are non-refundable.
            </li>
            <li>
              Refund eligibility is determined at the time of your request based
              on the code's status.
            </li>
          </ul>

          <h2>How to Request a Refund</h2>
          <p>To request a refund, email support@divinitycoin.com with:</p>
          <ul>
            <li>Your transaction ID or payment confirmation</li>
            <li>Email address used for purchase</li>
            <li>The credit code (if available)</li>
            <li>Reason for refund request</li>
          </ul>
          <p>We typically respond within 24-48 hours on business days.</p>

          <h2>Refund Processing</h2>
          <ul>
            <li>Refunds are processed to your original payment method</li>
            <li>Processing typically takes 5-10 business days depending on your bank</li>
            <li>You'll receive email confirmation when your refund is processed</li>
            <li>Credit card refunds may take an additional billing cycle to appear on your statement</li>
          </ul>

          <h2>Code Revocation</h2>
          <p>
            When a refund is issued, the associated credit code is immediately
            revoked and cannot be used for redemption. If the code has already
            been redeemed, a refund cannot be issued.
          </p>

          <h2>No Partial Refunds</h2>
          <p>
            <strong>We do not offer partial refunds.</strong> Refunds are only available for the
            full original purchase amount. If you have redeemed your code on a partner
            platform and spent any portion of the balance, your purchase is no longer
            eligible for a refund. This policy ensures fairness and prevents abuse of
            the refund system.
          </p>

          <h2>Disputes and Chargebacks</h2>
          <p>
            Please contact us directly before initiating a chargeback with your
            bank or credit card company. We can often resolve issues faster through
            direct communication. Chargebacks initiated without first contacting us
            may result in account restrictions and may delay resolution.
          </p>

          <h2>Contact Information</h2>
          <p>
            For refund requests or questions:
          </p>
          <p>
            <strong>DVCKS1 LLC</strong><br />
            DBA DivinityCoin<br />
            Email: support@divinitycoin.com<br />
            Response time: 24-48 hours (business days)
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
