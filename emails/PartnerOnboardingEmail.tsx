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

interface PartnerOnboardingEmailProps {
  partnerName?: string;
  contactName?: string;
  setupUrl?: string;
  expiresIn?: string;
}

export const PartnerOnboardingEmail = ({
  partnerName = 'Partner',
  contactName = 'Partner',
  setupUrl = 'https://divinitycoin.com/partners/setup?token=xxx',
  expiresIn = '7 days',
}: PartnerOnboardingEmailProps) => {
  const previewText = `Your DivinityCoin partner application has been approved!`;

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
            <Heading style={heading}>Welcome to the Partner Program! 🎉</Heading>

            <Text style={paragraph}>
              Hi {contactName},
            </Text>

            <Text style={paragraph}>
              Great news! Your partner application for <strong>{partnerName}</strong> has been approved.
              You're now ready to complete your account setup and start integrating DivinityCoin.
            </Text>

            <Section style={buttonSection}>
              <Link href={setupUrl} style={button}>
                Complete Account Setup
              </Link>
            </Section>

            <Text style={smallText}>
              This link expires in {expiresIn}. If you need a new link, please contact support.
            </Text>

            <Section style={stepsSection}>
              <Heading as="h3" style={subheading}>What's Next?</Heading>

              <Section style={stepRow}>
                <Text style={stepNumber}>1</Text>
                <Text style={stepText}>
                  <strong>Create Your Password</strong> - Set up secure access to your partner portal
                </Text>
              </Section>

              <Section style={stepRow}>
                <Text style={stepNumber}>2</Text>
                <Text style={stepText}>
                  <strong>Confirm Company Details</strong> - Review and update your business information
                </Text>
              </Section>

              <Section style={stepRow}>
                <Text style={stepNumber}>3</Text>
                <Text style={stepText}>
                  <strong>Set Up Payouts</strong> - Add your bank details for settlement payments
                </Text>
              </Section>

              <Section style={stepRow}>
                <Text style={stepNumber}>4</Text>
                <Text style={stepText}>
                  <strong>Get API Keys</strong> - Generate credentials and start integrating
                </Text>
              </Section>
            </Section>

            <Section style={infoBox}>
              <Text style={infoTitle}>Settlement Details</Text>
              <Text style={infoText}>
                • 6% platform fee on all credit transactions
              </Text>
              <Text style={infoText}>
                • Weekly settlements (or custom frequency)
              </Text>
              <Text style={infoText}>
                • Direct deposit to your bank account
              </Text>
            </Section>

            <Text style={paragraph}>
              Need help? Our developer support team is here to assist with your integration.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Questions? Contact us at{' '}
              <Link href="mailto:partners@divinitycoin.com" style={link}>
                partners@divinitycoin.com
              </Link>
            </Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} DivinityCoin. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default PartnerOnboardingEmail;

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

const smallText = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 20px',
  textAlign: 'center' as const,
};

const buttonSection = {
  textAlign: 'center' as const,
  margin: '30px 0 15px',
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

const stepsSection = {
  margin: '30px 0',
};

const stepRow = {
  display: 'flex',
  alignItems: 'flex-start',
  margin: '12px 0',
};

const stepNumber = {
  backgroundColor: '#6366f1',
  borderRadius: '50%',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  width: '24px',
  height: '24px',
  lineHeight: '24px',
  textAlign: 'center' as const,
  margin: '0 12px 0 0',
};

const stepText = {
  color: '#525f7f',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0',
  flex: '1',
};

const infoBox = {
  backgroundColor: '#f0f9ff',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '20px 0',
  borderLeft: '4px solid #6366f1',
};

const infoTitle = {
  color: '#1a1a1a',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0 0 10px',
};

const infoText = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '4px 0',
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

const link = {
  color: '#6366f1',
  textDecoration: 'none',
};
