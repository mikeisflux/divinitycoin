import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface UnredeemedReminderEmailProps {
  code?: string;
  amount?: number;
  purchaseDate?: string;
  daysUnredeemed?: number;
  expiryDate?: string;
}

export const UnredeemedReminderEmail = ({
  code = 'XXXX-XXXX-XXXX-XXXX',
  amount = 50,
  purchaseDate = new Date().toLocaleDateString(),
  daysUnredeemed = 30,
  expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
}: UnredeemedReminderEmailProps) => {
  const previewText = `Your $${amount} DivinityCoin gift card is waiting to be used!`;

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
            <Heading style={heading}>Don't Forget Your Credits! 🎁</Heading>

            <Text style={paragraph}>
              You have a ${amount} DivinityCoin gift card that hasn't been redeemed yet. It's been {daysUnredeemed} days since your purchase - we wanted to make sure you didn't forget about it!
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
                <strong>Purchased:</strong> {purchaseDate}
              </Text>
              <Text style={detailRow}>
                <strong>Valid Until:</strong> {expiryDate}
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Heading as="h3" style={subheading}>Ready to Use Your Credits?</Heading>
              <Text style={paragraph}>
                Visit any of our partner platforms and enter your code to start supporting creators you love!
              </Text>
              <Link href="https://divinitycoin.com/redeem" style={button}>
                Find Where to Redeem
              </Link>
            </Section>

            <Section style={suggestionsSection}>
              <Heading as="h3" style={subheading}>Ideas for Your Credits</Heading>
              <Text style={suggestionText}>
                💡 Back a project from your favorite creator
              </Text>
              <Text style={suggestionText}>
                🎨 Support an indie game or art project
              </Text>
              <Text style={suggestionText}>
                🎵 Help fund an album or music project
              </Text>
              <Text style={suggestionText}>
                📚 Contribute to creative writing or publishing
              </Text>
            </Section>

            <Text style={footnote}>
              This is a friendly reminder about your unused gift card. Your credits don't expire until {expiryDate}, so there's no rush - we just wanted to make sure you didn't forget!
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Questions?{' '}
              <Link href="mailto:support@divinitycoin.com" style={link}>
                Contact Support
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
              <Link href="https://divinitycoin.com/unsubscribe" style={link}>Unsubscribe</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default UnredeemedReminderEmail;

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
  margin: '0 0 12px',
};

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 20px',
};

const codeSection = {
  backgroundColor: '#fef3c7',
  border: '2px dashed #f59e0b',
  borderRadius: '8px',
  padding: '24px',
  textAlign: 'center' as const,
  margin: '24px 0',
};

const codeLabel = {
  color: '#92400e',
  fontSize: '14px',
  fontWeight: '500',
  margin: '0 0 8px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const codeValue = {
  color: '#78350f',
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

const ctaSection = {
  textAlign: 'center' as const,
  margin: '30px 0',
  padding: '24px',
  backgroundColor: '#f0f9ff',
  borderRadius: '8px',
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

const suggestionsSection = {
  margin: '30px 0',
};

const suggestionText = {
  color: '#525f7f',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '8px 0',
};

const footnote = {
  color: '#8898aa',
  fontSize: '13px',
  fontStyle: 'italic' as const,
  lineHeight: '20px',
  margin: '24px 0 0',
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
