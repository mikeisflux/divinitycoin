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

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

interface AdminAlertEmailProps {
  alertType?: string;
  severity?: AlertSeverity;
  message?: string;
  details?: Record<string, string>;
  timestamp?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export const AdminAlertEmail = ({
  alertType = 'System Alert',
  severity = 'warning',
  message = 'An important event occurred that requires your attention.',
  details = {},
  timestamp = new Date().toISOString(),
  actionUrl = 'https://divinitycoin.com/admin',
  actionLabel = 'View Dashboard',
}: AdminAlertEmailProps) => {
  const previewText = `[${severity.toUpperCase()}] ${alertType}`;

  const severityColors: Record<AlertSeverity, { bg: string; border: string; text: string }> = {
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
    critical: { bg: '#fef2f2', border: '#dc2626', text: '#7f1d1d' },
  };

  const colors = severityColors[severity];

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Heading style={logo}>DivinityCoin Admin</Heading>
          </Section>

          <Section style={content}>
            <Section style={{
              ...alertBanner,
              backgroundColor: colors.bg,
              borderLeft: `4px solid ${colors.border}`,
            }}>
              <Text style={{ ...alertSeverity, color: colors.text }}>
                {severity.toUpperCase()}
              </Text>
              <Text style={{ ...alertTitle, color: colors.text }}>
                {alertType}
              </Text>
            </Section>

            <Text style={paragraph}>{message}</Text>

            {Object.keys(details).length > 0 && (
              <Section style={detailsSection}>
                <Heading as="h3" style={subheading}>Details</Heading>
                {Object.entries(details).map(([key, value]) => (
                  <Text key={key} style={detailRow}>
                    <strong>{key}:</strong> {value}
                  </Text>
                ))}
              </Section>
            )}

            <Section style={metaSection}>
              <Text style={metaText}>
                <strong>Timestamp:</strong> {timestamp}
              </Text>
              <Text style={metaText}>
                <strong>Environment:</strong> {process.env.NODE_ENV || 'production'}
              </Text>
            </Section>

            <Section style={buttonSection}>
              <Link href={actionUrl} style={button}>
                {actionLabel}
              </Link>
            </Section>

            <Text style={paragraph}>
              This is an automated alert from your DivinityCoin system. Please review and take appropriate action.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              This alert was sent to all administrators.
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

export default AdminAlertEmail;

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

const alertBanner = {
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 24px',
};

const alertSeverity = {
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '0.5px',
  margin: '0 0 4px',
};

const alertTitle = {
  fontSize: '20px',
  fontWeight: '600',
  margin: '0',
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
  backgroundColor: '#fafafa',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '20px 0',
};

const detailRow = {
  color: '#525f7f',
  fontSize: '14px',
  margin: '6px 0',
  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
};

const metaSection = {
  borderTop: '1px solid #e6ebf1',
  paddingTop: '16px',
  margin: '20px 0',
};

const metaText = {
  color: '#8898aa',
  fontSize: '13px',
  margin: '4px 0',
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
