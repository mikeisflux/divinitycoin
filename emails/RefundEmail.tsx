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

interface RefundEmailProps {
  amount: number;
  refundDate?: string;
  transactionId?: string;
  reason?: string;
}

export const RefundEmail = ({
  amount = 50,
  refundDate = new Date().toLocaleDateString(),
  transactionId = 'TXN_XXXXXXXX',
  reason = 'Customer request',
}: RefundEmailProps) => {
  const previewText = `Your $${amount} refund has been processed`;

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
            <Heading style={heading}>Refund Processed</Heading>

            <Text style={paragraph}>
              We've processed your refund request. The funds should appear in your original payment method within 5-10 business days.
            </Text>

            <Section style={detailsSection}>
              <Text style={detailRow}>
                <strong>Refund Amount:</strong> ${amount}.00 USD
              </Text>
              <Text style={detailRow}>
                <strong>Date Processed:</strong> {refundDate}
              </Text>
              <Text style={detailRow}>
                <strong>Transaction ID:</strong> {transactionId}
              </Text>
              {reason && (
                <Text style={detailRow}>
                  <strong>Reason:</strong> {reason}
                </Text>
              )}
            </Section>

            <Section style={infoSection}>
              <Heading as="h3" style={subheading}>Important Information</Heading>
              <Text style={infoText}>
                • Any gift card codes associated with this purchase have been revoked and can no longer be used
              </Text>
              <Text style={infoText}>
                • If the code was already redeemed, credits may be deducted from the recipient's balance
              </Text>
              <Text style={infoText}>
                • Refund processing time depends on your financial institution
              </Text>
            </Section>

            <Text style={paragraph}>
              If you have any questions about this refund, please don't hesitate to contact our support team.
            </Text>

            <Section style={buttonSection}>
              <Link href="mailto:support@creatorcredits.com" style={button}>
                Contact Support
              </Link>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Questions? Contact us at{' '}
              <Link href="mailto:support@creatorcredits.com" style={link}>
                support@creatorcredits.com
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

export default RefundEmail;

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
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px',
};

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 20px',
};

const detailsSection = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '20px 0',
  borderLeft: '4px solid #f59e0b',
};

const detailRow = {
  color: '#525f7f',
  fontSize: '14px',
  margin: '8px 0',
};

const infoSection = {
  backgroundColor: '#fafafa',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '20px 0',
};

const infoText = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '6px 0',
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

const link = {
  color: '#6366f1',
  textDecoration: 'none',
};
