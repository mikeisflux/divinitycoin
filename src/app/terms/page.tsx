// app/terms/page.tsx

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">
          Terms of Service
        </h1>
        <p className="text-neutral-500 mb-12">Last Updated: January 2025</p>

        <div className="prose prose-neutral max-w-none">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By using CreatorCredits ("Service"), you agree to be bound by these
            Terms of Service. If you do not agree to these terms, please do not
            use our Service.
          </p>
          <p>
            You must be at least 18 years old or have parental consent to use
            this Service.
          </p>

          <h2>2. Service Description</h2>
          <p>
            CreatorCredits provides a digital credit purchase service. Users can
            purchase credits that can be redeemed on partner platforms to
            support creators. We act as an intermediary between purchasers and
            partner platforms.
          </p>

          <h2>3. Purchases and Payments</h2>
          <p>
            All payments are processed securely through Stripe. We accept major
            credit and debit cards. Prices are displayed in USD. By completing a
            purchase, you authorize us to charge your payment method.
          </p>
          <p>
            We do not offer payment plans, financing, or pay-over-time options.
          </p>

          <h2>4. Gift Card Terms</h2>
          <ul>
            <li>Credits are issued as unique codes delivered via email</li>
            <li>Each code can only be redeemed once</li>
            <li>Codes are non-transferable after redemption</li>
            <li>Credits have no cash value and cannot be exchanged for cash</li>
            <li>Credits do not expire unless otherwise stated</li>
            <li>Lost or stolen codes cannot be replaced once redeemed</li>
          </ul>

          <h2>5. Redemption</h2>
          <p>
            Credits are redeemed on partner platforms according to their
            respective terms. CreatorCredits is not responsible for the
            services, content, or policies of partner platforms.
          </p>

          <h2>6. Refunds</h2>
          <p>
            Unredeemed credits may be refunded within 30 days of purchase.
            Redeemed credits are non-refundable. See our{' '}
            <a href="/refunds" className="text-primary-600 hover:underline">
              Refund Policy
            </a>{' '}
            for complete details.
          </p>

          <h2>7. Prohibited Uses</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for fraudulent purposes</li>
            <li>Attempt to exploit, hack, or reverse-engineer the Service</li>
            <li>Resell credits without authorization</li>
            <li>Violate any applicable laws or regulations</li>
            <li>Violate the terms of our partner platforms</li>
          </ul>

          <h2>8. Intellectual Property</h2>
          <p>
            All content, trademarks, and intellectual property associated with
            CreatorCredits are owned by us or our licensors. You may not use our
            branding without permission.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            The Service is provided "as is" without warranties of any kind.
            CreatorCredits shall not be liable for any indirect, incidental, or
            consequential damages arising from your use of the Service.
          </p>

          <h2>10. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless CreatorCredits and its
            affiliates from any claims, damages, or expenses arising from your
            use of the Service or violation of these terms.
          </p>

          <h2>11. Changes to Terms</h2>
          <p>
            We may update these terms at any time. Continued use of the Service
            after changes constitutes acceptance of the new terms. Significant
            changes will be communicated via email to registered users.
          </p>

          <h2>12. Governing Law</h2>
          <p>
            These terms are governed by the laws of the State of Delaware, USA.
            Any disputes shall be resolved in the courts of Delaware.
          </p>

          <h2>13. Contact</h2>
          <p>
            For questions about these terms, contact us at:
            <br />
            Email: legal@creatorcredits.com
          </p>
        </div>
      </div>
    </div>
  );
}
