// app/privacy/page.tsx

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">
          Privacy Policy
        </h1>
        <p className="text-neutral-500 mb-12">Last Updated: December 2024</p>

        <div className="prose prose-neutral max-w-none">
          <h2>1. Introduction</h2>
          <p>
            <strong>DVCKS1 LLC, doing business as DivinityCoin</strong> ("we," "us,"
            "our," or "Company"), an Indiana limited liability company, is committed
            to protecting your privacy. This Privacy Policy explains how we collect,
            use, disclose, and protect your personal information when you use our
            website and services (collectively, the "Service").
          </p>
          <p>
            By using our Service, you agree to the collection and use of information
            in accordance with this Privacy Policy. If you do not agree with this
            policy, please do not use our Service.
          </p>

          <h2>2. Company Information</h2>
          <p>
            <strong>DVCKS1 LLC</strong><br />
            DBA DivinityCoin<br />
            State of Indiana, USA<br />
            Email: privacy@divinitycoin.com
          </p>

          <h2>3. Information We Collect</h2>

          <h3>3.1 Information You Provide Directly</h3>
          <ul>
            <li>Email address (required for code delivery and account creation)</li>
            <li>Name (optional, for account personalization)</li>
            <li>Payment information (processed securely by Stripe; we do not store full card numbers)</li>
            <li>Partner application information (business name, contact details, tax ID for business partners)</li>
          </ul>

          <h3>3.2 Information Collected Automatically</h3>
          <ul>
            <li>IP address</li>
            <li>Device type, operating system, and browser information</li>
            <li>Usage data (pages visited, actions taken, time spent)</li>
            <li>Cookies and similar tracking technologies</li>
            <li>Referring website or source</li>
          </ul>

          <h3>3.3 Information from Third Parties</h3>
          <ul>
            <li>Payment confirmation and transaction data from Stripe</li>
            <li>Redemption and usage data from partner platforms</li>
          </ul>

          <h2>4. How We Use Your Information</h2>
          <p>We use your information for the following purposes:</p>
          <ul>
            <li>Process transactions and deliver credit codes to your email</li>
            <li>Create and manage your user account</li>
            <li>Send transactional communications (purchase confirmations, codes, receipts)</li>
            <li>Prevent fraud, detect security threats, and protect our Service</li>
            <li>Improve and optimize our Service and user experience</li>
            <li>Respond to customer support inquiries</li>
            <li>Comply with legal obligations and enforce our Terms of Service</li>
            <li>Analyze usage patterns and trends (in aggregate, anonymized form)</li>
          </ul>

          <h2>5. Information Sharing and Disclosure</h2>
          <p>We may share your information with the following categories of recipients:</p>
          <ul>
            <li>
              <strong>Payment Processors (Stripe):</strong> To process your payments securely.
              Stripe's privacy policy governs their use of your data.
            </li>
            <li>
              <strong>Email Service Providers (SendGrid/SMTP):</strong> To deliver transactional
              emails including your credit codes.
            </li>
            <li>
              <strong>Partner Platforms:</strong> Limited information necessary for credit
              redemption (user identifier, redemption amount).
            </li>
            <li>
              <strong>Legal Authorities:</strong> When required by law, court order, or
              government request, or to protect our rights and safety.
            </li>
            <li>
              <strong>Business Transfers:</strong> In connection with a merger, acquisition,
              or sale of assets, your information may be transferred to the acquiring entity.
            </li>
          </ul>
          <p>
            <strong>We do not sell your personal information to third parties.</strong>
          </p>

          <h2>6. Data Retention</h2>
          <p>
            We retain your personal information for as long as necessary to provide our
            Service and fulfill the purposes described in this Privacy Policy. Specifically:
          </p>
          <ul>
            <li>Transaction records: 7 years (for legal, tax, and accounting purposes)</li>
            <li>Account information: Until you request deletion</li>
            <li>Usage logs: 90 days</li>
          </ul>
          <p>
            You may request deletion of non-essential data at any time by contacting us
            at privacy@divinitycoin.com.
          </p>

          <h2>7. Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your information,
            including:
          </p>
          <ul>
            <li>Encryption in transit using TLS/SSL</li>
            <li>Secure payment processing through Stripe (PCI-DSS compliant)</li>
            <li>Hashed storage of sensitive codes and passwords</li>
            <li>Access controls and authentication requirements</li>
            <li>Regular security assessments</li>
          </ul>
          <p>
            However, no method of transmission over the Internet or electronic storage
            is 100% secure. While we strive to protect your information, we cannot
            guarantee absolute security.
          </p>

          <h2>8. Your Rights and Choices</h2>
          <p>
            Depending on your location, you may have certain rights regarding your
            personal information:
          </p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Correction:</strong> Request correction of inaccurate data</li>
            <li><strong>Deletion:</strong> Request deletion of your personal data</li>
            <li><strong>Portability:</strong> Request export of your data in a portable format</li>
            <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
          </ul>
          <p>
            To exercise these rights, contact us at privacy@divinitycoin.com. We will
            respond to your request within 30 days.
          </p>

          <h2>9. Cookies and Tracking Technologies</h2>
          <p>
            We use cookies and similar technologies to:
          </p>
          <ul>
            <li>Maintain session state and authentication</li>
            <li>Remember your preferences</li>
            <li>Analyze usage patterns and improve our Service</li>
            <li>Prevent fraud and enhance security</li>
          </ul>
          <p>
            You can control cookies through your browser settings. Disabling cookies
            may affect the functionality of our Service.
          </p>

          <h2>10. International Data Transfers</h2>
          <p>
            Your information may be processed and stored in the United States where
            our servers and service providers are located. By using our Service, you
            consent to the transfer of your information to the United States, which
            may have different data protection laws than your country of residence.
          </p>

          <h2>11. Children's Privacy</h2>
          <p>
            Our Service is not intended for children under 13 years of age. We do not
            knowingly collect personal information from children under 13. If you are
            a parent or guardian and believe your child has provided us with personal
            information, please contact us at privacy@divinitycoin.com and we will
            delete such information.
          </p>

          <h2>12. California Privacy Rights (CCPA)</h2>
          <p>
            If you are a California resident, you have additional rights under the
            California Consumer Privacy Act (CCPA):
          </p>
          <ul>
            <li>Right to know what personal information we collect and how we use it</li>
            <li>Right to delete your personal information</li>
            <li>Right to opt-out of the sale of personal information (we do not sell personal information)</li>
            <li>Right to non-discrimination for exercising your privacy rights</li>
          </ul>
          <p>
            To exercise your CCPA rights, contact us at privacy@divinitycoin.com or
            call us using the contact information provided below.
          </p>

          <h2>13. Indiana Privacy Considerations</h2>
          <p>
            As an Indiana-based company, we comply with applicable Indiana state laws
            regarding data protection and consumer privacy. Indiana residents may
            contact us with any privacy-related concerns at the contact information below.
          </p>

          <h2>14. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in
            our practices or applicable laws. We will notify you of material changes
            by posting the updated policy on our website with a new "Last Updated" date.
            For registered users, we may also send notification via email. Your continued
            use of the Service after such changes constitutes acceptance of the updated policy.
          </p>

          <h2>15. Contact Us</h2>
          <p>
            For privacy inquiries, questions, or to exercise your rights, please contact us:
          </p>
          <p>
            <strong>DVCKS1 LLC</strong><br />
            DBA DivinityCoin<br />
            Email: privacy@divinitycoin.com
          </p>
          <p>
            For general legal inquiries: legal@divinitycoin.com
          </p>
        </div>
      </div>
    </div>
  );
}
