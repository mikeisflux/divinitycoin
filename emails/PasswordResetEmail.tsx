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

interface PasswordResetEmailProps {
  resetLink?: string;
  email?: string;
  expiresIn?: string;
}

export const PasswordResetEmail = ({
  resetLink = 'https://creatorcredits.com/reset-password?token=xxxxx',
  email = 'user@example.com',
  expiresIn = '1 hour',
}: PasswordResetEmailProps) => {
  const previewText = `Reset your CreatorCredits password`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Heading style={logo}>CreatorCredits</Heading>
          </Section>

          <Section style={content}>
            <Heading style={heading}>Reset Your Password</Heading>

            <Text style={paragraph}>
              We received a request to reset the password for your CreatorCredits account associated with {email}.
            </Text>

            <Section style={buttonSection}>
              <Link href={resetLink} style={button}>
                Reset Password
              </Link>
            </Section>

            <Text style={paragraph}>
              This link will expire in {expiresIn}. If you didn't request a password reset, you can safely ignore this email.
            </Text>

            <Section style={warningSection}>
              <Text style={warningText}>
                <strong>Security Tips:</strong>
              </Text>
              <Text style={warningText}>
                • Never share this link with anyone
              </Text>
              <Text style={warningText}>
                • CreatorCredits will never ask for your password via email
              </Text>
              <Text style={warningText}>
                • If you didn't request this reset, your account may be at risk
              </Text>
            </Section>

            <Text style={paragraph}>
              If you're having trouble clicking the button, copy and paste this URL into your browser:
            </Text>
            <Text style={urlText}>{resetLink}</Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Need help?{' '}
              <Link href="mailto:support@creatorcredits.com" style={link}>
                Contact Support
              </Link>
            </Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} CreatorCredits. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordResetEmail;

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

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 20px',
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

const warningSection = {
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '20px 0',
  borderLeft: '4px solid #ef4444',
};

const warningText = {
  color: '#991b1b',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '4px 0',
};

const urlText = {
  color: '#6366f1',
  fontSize: '12px',
  lineHeight: '20px',
  wordBreak: 'break-all' as const,
  backgroundColor: '#f8fafc',
  padding: '12px',
  borderRadius: '4px',
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
