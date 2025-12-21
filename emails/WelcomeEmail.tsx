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

interface WelcomeEmailProps {
  userName?: string;
  email?: string;
}

export const WelcomeEmail = ({
  userName = 'Creator',
  email = 'user@example.com',
}: WelcomeEmailProps) => {
  const previewText = `Welcome to DivinityCoin - Start supporting creators today!`;

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
            <Heading style={heading}>Welcome to DivinityCoin! 🎉</Heading>

            <Text style={paragraph}>
              Hi {userName},
            </Text>

            <Text style={paragraph}>
              Thanks for joining DivinityCoin! We're excited to have you as part of our community dedicated to supporting creators.
            </Text>

            <Section style={featuresSection}>
              <Heading as="h3" style={subheading}>What You Can Do</Heading>

              <Section style={featureRow}>
                <Text style={featureIcon}>💳</Text>
                <Text style={featureText}>
                  <strong>Purchase Gift Cards</strong> - Buy credits instantly with any major credit card
                </Text>
              </Section>

              <Section style={featureRow}>
                <Text style={featureIcon}>🎁</Text>
                <Text style={featureText}>
                  <strong>Support Creators</strong> - Use your credits on partner platforms to back projects you love
                </Text>
              </Section>

              <Section style={featureRow}>
                <Text style={featureIcon}>🔒</Text>
                <Text style={featureText}>
                  <strong>Secure & Private</strong> - Your transactions are protected with bank-level security
                </Text>
              </Section>
            </Section>

            <Section style={buttonSection}>
              <Link href="https://divinitycoin.com/buy" style={button}>
                Get Your First Credits
              </Link>
            </Section>

            <Section style={tipsSection}>
              <Heading as="h3" style={subheading}>Quick Tips</Heading>
              <Text style={tipText}>
                • Keep your gift card codes safe - treat them like cash!
              </Text>
              <Text style={tipText}>
                • Credits never expire, so you can use them whenever you're ready
              </Text>
              <Text style={tipText}>
                • Check our FAQ if you have any questions
              </Text>
            </Section>

            <Text style={paragraph}>
              We're here to help! If you have any questions, don't hesitate to reach out.
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
              <Link href="https://divinitycoin.com/faq" style={link}>FAQ</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;

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

const featuresSection = {
  margin: '30px 0',
};

const featureRow = {
  display: 'flex',
  alignItems: 'flex-start',
  margin: '12px 0',
};

const featureIcon = {
  fontSize: '24px',
  margin: '0 12px 0 0',
  lineHeight: '1',
};

const featureText = {
  color: '#525f7f',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0',
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

const tipsSection = {
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '20px 0',
};

const tipText = {
  color: '#166534',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '6px 0',
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
