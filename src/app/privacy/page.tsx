// app/privacy/page.tsx

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">
          Privacy Policy
        </h1>
        <p className="text-neutral-500 mb-12">Last Updated: January 2025</p>

        <div className="prose prose-neutral max-w-none">
          <h2>1. Introduction</h2>
          <p>
            CreatorCredits ("we", "us", "our") is committed to protecting your
            privacy. This policy explains how we collect, use, and protect your
            personal information.
          </p>

          <h2>2. Information We Collect</h2>
          <h3>Information You Provide</h3>
          <ul>
            <li>Email address (for code delivery)</li>
            <li>Payment information (processed by Stripe)</li>
          </ul>

          <h3>Information Collected Automatically</h3>
          <ul>
            <li>IP address</li>
            <li>Device and browser information</li>
            <li>Usage data (pages visited, actions taken)</li>
          </ul>

          <h3>Information from Third Parties</h3>
          <ul>
            <li>Payment confirmation from Stripe</li>
            <li>Redemption data from partner platforms</li>
          </ul>

          <h2>3. How We Use Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Process transactions and deliver credit codes</li>
            <li>Send transactional emails (purchase confirmations, codes)</li>
            <li>Prevent fraud and ensure security</li>
            <li>Improve our services</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2>4. Information Sharing</h2>
          <p>We share information with:</p>
          <ul>
            <li>
              <strong>Stripe:</strong> For payment processing
            </li>
            <li>
              <strong>SendGrid:</strong> For email delivery
            </li>
            <li>
              <strong>Partner Platforms:</strong> Limited data for redemption
            </li>
            <li>
              <strong>Legal Authorities:</strong> When required by law
            </li>
          </ul>
          <p>We do not sell your personal information.</p>

          <h2>5. Data Retention</h2>
          <p>
            We retain transaction records for 7 years for legal and accounting
            purposes. You may request deletion of non-essential data at any
            time.
          </p>

          <h2>6. Security</h2>
          <p>
            We implement industry-standard security measures including:
            encryption in transit (TLS), secure payment processing (Stripe
            PCI-DSS), and access controls. However, no system is 100% secure.
          </p>

          <h2>7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data</li>
            <li>Opt-out of marketing communications</li>
          </ul>
          <p>
            To exercise these rights, contact us at privacy@creatorcredits.com.
          </p>

          <h2>8. Cookies</h2>
          <p>
            We use essential cookies for site functionality. We may use
            analytics cookies to understand usage patterns. You can control
            cookies through your browser settings.
          </p>

          <h2>9. International Transfers</h2>
          <p>
            Your data may be processed in the United States. By using our
            Service, you consent to this transfer.
          </p>

          <h2>10. Children's Privacy</h2>
          <p>
            Our Service is not intended for children under 13. We do not
            knowingly collect information from children under 13.
          </p>

          <h2>11. California Privacy Rights</h2>
          <p>
            California residents have additional rights under the CCPA. We do
            not sell personal information. For CCPA requests, contact us at
            privacy@creatorcredits.com.
          </p>

          <h2>12. Changes to This Policy</h2>
          <p>
            We may update this policy periodically. Changes will be posted on
            this page with an updated date.
          </p>

          <h2>13. Contact Us</h2>
          <p>
            For privacy inquiries:
            <br />
            Email: privacy@creatorcredits.com
          </p>
        </div>
      </div>
    </div>
  );
}
