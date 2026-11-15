// lib/security/iocs.ts
// Indicators of compromise from FBI FLASH-20261113-001, "Threat Overview of
// ARTEX Autonomous Penetration Testing Framework" (13 November 2026,
// TLP:CLEAR). ARTEX is an LLM-driven agentic attack framework; the FBI's
// own guidance is that these addresses are historically observed
// infrastructure, often cloud-hosted and reassignable, and should be
// corroborated rather than blocked on sight. So a match here is reported
// as a critical security event and alerted on; it is only refused at the
// edge when IOC_BLOCK_MODE=block is set deliberately.
//
// This module is imported by the edge middleware: no Node or Prisma here.

export interface IocMatch {
  indicator: string;
  context: string;
}

const IP_CONTEXT: Record<string, string> = {
  '38.244.50.120': 'ARTEX host and open directory (South Korea financial campaign)',
  '144.172.64.60': 'ConnectWise campaign; sign-ins and Graph API activity',
  '144.172.64.99': 'ConnectWise campaign; sign-ins and Graph API activity',
  '144.172.64.128': 'ConnectWise campaign; sign-ins and Graph API activity',
  '187.15.88.186': 'Graph API access via compromised apps (transient VPN, 15-16 Oct 2026)',
  '187.15.90.217': 'Graph API access via compromised apps (transient VPN, 15-16 Oct 2026)',
  '187.15.89.186': 'Graph API access via compromised apps (transient VPN, 15-16 Oct 2026)',
  '101.53.80.20': 'Proxy IP (South Korea financial campaign)',
  '205.214.59.31': 'Proxy IP (South Korea financial campaign)',
  '124.155.252.63': 'Proxy IP (South Korea financial campaign)',
  '154.201.79.246': 'Proxy IP (South Korea financial campaign)',
  '23.248.249.90': 'Proxy IP (South Korea financial campaign)',
  '23.158.220.98': 'Proxy IP (South Korea financial campaign)',
  '103.248.148.84': 'Proxy IP (South Korea financial campaign)',
  '203.160.133.172': 'Proxy IP (South Korea financial campaign)',
  '209.209.85.38': 'Proxy IP (South Korea financial campaign)',
  '199.19.95.66': 'WISP C2 node (Storm-3358; active as of 6 Nov 2026)',
  '199.19.95.67': 'WISP C2 node (Storm-3358; active as of 6 Nov 2026)',
  '199.19.95.68': 'WISP C2 node (Storm-3358; active as of 6 Nov 2026)',
  '91.92.240.238': 'ARTEX server (Storm-3358; active as of 6 Nov 2026)',
  '85.11.168.45': 'ARTEX server (Storm-3358; active as of 6 Nov 2026)',
  '178.16.54.129': 'ARTEX server (Storm-3358; active as of 6 Nov 2026)',
  '31.77.229.35': 'ARTEX server (Storm-3358; active as of 6 Nov 2026)',
  '85.11.167.52': 'C2 server (Storm-3358; active as of 6 Nov 2026)',
};

/** Domains named in the FLASH. Relevant to egress review, not inbound matching. */
export const IOC_DOMAINS = ['xcai.pro'] as const;

/**
 * LLM API hosts the FLASH lists as behavioural indicators when a server
 * makes unexpected outbound calls to them. This application never calls
 * any of these; an outbound connection from the box to one of them is a
 * finding. Used by the hardening runbook's egress check.
 */
export const IOC_LLM_API_HOSTS = [
  'api.anthropic.com',
  'api.deepseek.com',
  'open.bigmodel.cn',
  'api.x.ai',
] as const;

export const IOC_SOURCE = 'FBI FLASH-20261113-001 (ARTEX), 13 Nov 2026';

export function matchIoc(ip: string | null | undefined): IocMatch | null {
  if (!ip) return null;
  const context = IP_CONTEXT[ip];
  return context ? { indicator: ip, context } : null;
}

export function iocIpList(): string[] {
  return Object.keys(IP_CONTEXT);
}
