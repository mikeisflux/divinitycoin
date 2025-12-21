import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface GiftCardEmailProps {
  code: string;
  amount: number;
  recipientEmail?: string;
  purchaseDate?: string;
  expiryDate?: string;
}

export const GiftCardEmail = ({
  code = 'XXXX-XXXX-XXXX-XXXX',
  amount = 50,
  recipientEmail = 'user@example.com',
  purchaseDate = new Date().toLocaleDateString(),
  expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
}: GiftCardEmailProps) => {
  const previewText = `Your $${amount} DivinityCoin Gift Card is ready!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Heading style={logo}>DivinityCoin</Heading>
          </Section>

          <Section style={content}>
            <Heading style={heading}>Your Gift Card is Ready! 🎉</Heading>

            <Text style={paragraph}>
              Thank you for your purchase! Your ${amount} DivinityCoin gift card is now active and ready to use.
            </Text>

            <Section style={codeSection}>
              <Text style={codeLabel}>Your Gift Card Code:</Text>
              <Text style={codeValue}>{code}</Text>
            </Section>

            <Section style={detailsSection}>
              <Text style={detailRow}>
                <strong>Amount:</strong> ${amount}.00 USD
              </Text>
              <Text style={detailRow}>
                <strong>Purchase Date:</strong> {purchaseDate}
              </Text>
              <Text style={detailRow}>
                <strong>Valid Until:</strong> {expiryDate}
              </Text>
            </Section>

            <Section style={stepsSection}>
              <Heading as="h3" style={subheading}>How to Use Your Credits</Heading>
              <Text style={step}>
                <strong>1.</strong> Visit any of our partner platforms
              </Text>
              <Text style={step}>
                <strong>2.</strong> Enter your gift card code at checkout or in your account settings
              </Text>
              <Text style={step}>
                <strong>3.</strong> Start supporting your favorite creators!
              </Text>
            </Section>

            <Section style={buttonSection}>
              <Link href="https://divinitycoin.com/redeem" style={button}>
                Find Where to Redeem
              </Link>
            </Section>

            <Text style={paragraph}>
              Keep this email safe - you'll need this code to redeem your credits.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Questions? Contact us at{' '}
              <Link href="mailto:support@divinitycoin.com" style={link}>
                support@divinitycoin.com
              </Link>
            </Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} DivinityCoin. All rights reserved.
            </Text>
            <Text style={footerLinks}>
              <Link href="https://divinitycoin.com/terms" style={link}>Terms</Link>
              {' • '}
              <Link href="https://divinitycoin.com/privacy" style={link}>Privacy</Link>
              {' • '}
              <Link href="https://divinitycoin.com/refunds" style={link}>Refunds</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default GiftCardEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0',
  maxWidth: '600px',
};

const logoSection = {
  padding: '20px 30px',
  borderBottom: '1px solid #e6ebf1',
};

const logo = {
  color: '#6366f1',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0',
};

const content = {
  padding: '30px',
};

const heading = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  margin: '0 0 20px',
};

const subheading = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 15px',
};

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 20px',
};

const codeSection = {
  backgroundColor: '#f8fafc',
  border: '2px dashed #e2e8f0',
  borderRadius: '8px',
  padding: '24px',
  textAlign: 'center' as const,
  margin: '24px 0',
};

const codeLabel = {
  color: '#64748b',
  fontSize: '14px',
  fontWeight: '500',
  margin: '0 0 8px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const codeValue = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: '700',
  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
  letterSpacing: '2px',
  margin: '0',
};

const detailsSection = {
  backgroundColor: '#fafafa',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '20px 0',
};

const detailRow = {
  color: '#525f7f',
  fontSize: '14px',
  margin: '8px 0',
};

const stepsSection = {
  margin: '30px 0',
};

const step = {
  color: '#525f7f',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '8px 0',
};

const buttonSection = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const button = {
  backgroundColor: '#6366f1',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 32px',
  textDecoration: 'none',
};

const footer = {
  borderTop: '1px solid #e6ebf1',
  padding: '20px 30px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#8898aa',
  fontSize: '13px',
  margin: '4px 0',
};

const footerLinks = {
  color: '#8898aa',
  fontSize: '13px',
  margin: '12px 0 0',
};

const link = {
  color: '#6366f1',
  textDecoration: 'none',
};
