// lib/dispute/bundle.ts
// Gathers all evidence for a transaction and assembles a download-ready
// zip bundle suitable for uploading as a chargeback response.

import PDFDocument from 'pdfkit';
import JSZip from 'jszip';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getStripeClient } from '@/lib/stripe';

// ─── Types ────────────────────────────────────────────────────────

export interface DisputeEvidenceData {
  source: 'partner' | 'legacy';
  paymentIntentId: string | null;
  internalId: string;
  amountCents: number;
  amountUsd: number;
  currency: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  email: string | null;
  platformUserId: string | null;
  pledgeId: string | null;
  projectId: string | null;
  partner: {
    id: string;
    name: string;
    slug: string;
  } | null;
  giftCard: {
    id: string;
    codeLast4: string | null;
    amount: number;
    status: string;
    purchasedByEmail: string | null;
    redeemedByEmail: string | null;
    redeemedAt: Date | null;
    redeemedOnPlatform: string | null;
    redeemedByPlatformUserId: string | null;
    activatedAt: Date | null;
  } | null;
  captures: Array<{
    id: string;
    amountCents: number;
    pledgeId: string;
    projectId: string;
    capturedAt: Date;
  }>;
}

// ─── Evidence lookup ──────────────────────────────────────────────

/**
 * Find a transaction by any of the IDs an admin might paste:
 *  - PendingPartnerPayment.id (cuid)
 *  - PendingPartnerPayment.paymentIntentId (pi_...)
 *  - Transaction.id (cuid)
 *  - Transaction.stripePaymentIntentId (pi_...)
 */
export async function gatherDisputeEvidence(
  idOrPi: string,
): Promise<DisputeEvidenceData | null> {
  const trimmed = idOrPi.trim();
  if (!trimmed) return null;

  // 1. Partner payment by internal id
  let pp = await prisma.pendingPartnerPayment.findUnique({
    where: { id: trimmed },
  });

  // 2. Partner payment by paymentIntentId
  if (!pp) {
    pp = await prisma.pendingPartnerPayment.findUnique({
      where: { paymentIntentId: trimmed },
    });
  }

  if (pp) {
    const [partner, giftCard, captures] = await Promise.all([
      prisma.partner.findUnique({
        where: { id: pp.partnerId },
        select: { id: true, name: true, slug: true },
      }),
      pp.giftCardId
        ? prisma.giftCard.findUnique({ where: { id: pp.giftCardId } })
        : null,
      pp.holdId
        ? prisma.creditCapture.findMany({
            where: { holdId: pp.holdId },
            include: { hold: { select: { pledgeId: true, projectId: true } } },
            orderBy: { capturedAt: 'desc' },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    return {
      source: 'partner',
      paymentIntentId: pp.paymentIntentId,
      internalId: pp.id,
      amountCents: pp.amount,
      amountUsd: pp.amount / 100,
      currency: pp.currency,
      status: pp.status,
      createdAt: pp.createdAt,
      completedAt: pp.completedAt,
      email: pp.email,
      platformUserId: pp.platformUserId,
      pledgeId: pp.pledgeId,
      projectId: pp.projectId,
      partner: partner,
      giftCard: giftCard
        ? {
            id: giftCard.id,
            codeLast4: giftCard.codeLast4,
            amount: Number(giftCard.amount),
            status: giftCard.status,
            purchasedByEmail: giftCard.purchasedByEmail,
            redeemedByEmail: giftCard.redeemedByEmail,
            redeemedAt: giftCard.redeemedAt,
            redeemedOnPlatform: giftCard.redeemedOnPlatform,
            redeemedByPlatformUserId: giftCard.redeemedByPlatformUserId,
            activatedAt: giftCard.activatedAt,
          }
        : null,
      captures: captures.map((c) => ({
        id: c.id,
        amountCents: Math.round(Number(c.amount) * 100),
        pledgeId: ('hold' in c && c.hold) ? c.hold.pledgeId : '',
        projectId: c.projectId,
        capturedAt: c.capturedAt,
      })),
    };
  }

  // 3. Legacy transaction by internal id, then by stripe id
  let tx = await prisma.transaction.findUnique({
    where: { id: trimmed },
    include: { giftCard: true, user: { select: { email: true } } },
  });
  if (!tx) {
    tx = await prisma.transaction.findFirst({
      where: { stripePaymentIntentId: trimmed },
      include: { giftCard: true, user: { select: { email: true } } },
    });
  }

  if (tx) {
    return {
      source: 'legacy',
      paymentIntentId: tx.stripePaymentIntentId,
      internalId: tx.id,
      amountCents: Math.round(Number(tx.amount) * 100),
      amountUsd: Number(tx.amount),
      currency: tx.currency,
      status: tx.status,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
      email: tx.guestEmail ?? tx.user?.email ?? null,
      platformUserId: null,
      pledgeId: null,
      projectId: null,
      partner: null,
      giftCard: tx.giftCard
        ? {
            id: tx.giftCard.id,
            codeLast4: tx.giftCard.codeLast4,
            amount: Number(tx.giftCard.amount),
            status: tx.giftCard.status,
            purchasedByEmail: tx.giftCard.purchasedByEmail,
            redeemedByEmail: tx.giftCard.redeemedByEmail,
            redeemedAt: tx.giftCard.redeemedAt,
            redeemedOnPlatform: tx.giftCard.redeemedOnPlatform,
            redeemedByPlatformUserId: tx.giftCard.redeemedByPlatformUserId,
            activatedAt: tx.giftCard.activatedAt,
          }
        : null,
      captures: [],
    };
  }

  return null;
}

// ─── PDF helpers ──────────────────────────────────────────────────

function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function fieldRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  const startX = doc.x;
  doc.font('Helvetica-Bold').fontSize(9).text(label, { continued: true });
  doc.font('Helvetica').fontSize(9).text(`  ${value}`);
  doc.x = startX;
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text(title);
  doc.moveTo(doc.x, doc.y + 2).lineTo(doc.x + 495, doc.y + 2)
    .strokeColor('#cccccc').lineWidth(0.5).stroke();
  doc.moveDown(0.4);
}

function pdfBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

// ─── Receipt PDF ──────────────────────────────────────────────────

export function generateReceiptPdf(ev: DisputeEvidenceData): Promise<Buffer> {
  return pdfBuffer((doc) => {
    // Header
    doc.fillColor('#2563eb').fontSize(20).font('Helvetica-Bold').text('Divinity Payments', { align: 'left' });
    doc.fontSize(9).fillColor('#666666').font('Helvetica').text('DVCKS1 LLC dba DivinityCoin · divinitycoin.com');
    doc.moveDown(0.5);

    doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold').text('Transaction Receipt', { align: 'left' });
    doc.fontSize(9).fillColor('#666666').font('Helvetica').text(
      `Generated ${formatDate(new Date())}   ·   Receipt #${ev.paymentIntentId ?? ev.internalId}`,
    );
    doc.fillColor('#000000');

    // Summary box
    sectionHeader(doc, 'Transaction Summary');
    fieldRow(doc, 'Payment Intent ID:', ev.paymentIntentId ?? '(legacy: ' + ev.internalId + ')');
    fieldRow(doc, 'Internal record ID:', ev.internalId);
    fieldRow(doc, 'Amount:', `${formatMoney(ev.amountCents, ev.currency)} (${ev.amountCents} cents)`);
    fieldRow(doc, 'Currency:', ev.currency.toUpperCase());
    fieldRow(doc, 'Status:', ev.status);
    fieldRow(doc, 'Created:', formatDate(ev.createdAt));
    fieldRow(doc, 'Completed:', formatDate(ev.completedAt));

    // Customer
    sectionHeader(doc, 'Cardholder / Customer');
    fieldRow(doc, 'Email:', ev.email ?? '—');
    fieldRow(doc, 'Platform User ID:', ev.platformUserId ?? '—');

    // Partner / pledge
    if (ev.partner || ev.pledgeId) {
      sectionHeader(doc, 'Partner Platform & Pledge');
      fieldRow(doc, 'Partner:', ev.partner ? `${ev.partner.name}  (slug: ${ev.partner.slug})` : '—');
      fieldRow(doc, 'Partner ID:', ev.partner?.id ?? '—');
      fieldRow(doc, 'Pledge ID:', ev.pledgeId ?? '—');
      fieldRow(doc, 'Project ID:', ev.projectId ?? '—');
    }

    // Gift card delivery + redemption
    sectionHeader(doc, 'Digital Credit Delivery & Redemption');
    if (ev.giftCard) {
      fieldRow(doc, 'Gift Card ID:', ev.giftCard.id);
      fieldRow(doc, 'Code (last 4):', ev.giftCard.codeLast4 ? `****${ev.giftCard.codeLast4}` : '—');
      fieldRow(doc, 'Amount:', formatMoney(Math.round(ev.giftCard.amount * 100), ev.currency));
      fieldRow(doc, 'Status:', ev.giftCard.status);
      fieldRow(doc, 'Purchased by email:', ev.giftCard.purchasedByEmail ?? '—');
      fieldRow(doc, 'Activated at:', formatDate(ev.giftCard.activatedAt));
      fieldRow(doc, 'Redeemed at:', formatDate(ev.giftCard.redeemedAt));
      fieldRow(doc, 'Redeemed on partner platform:', ev.giftCard.redeemedOnPlatform ?? '—');
      fieldRow(doc, 'Redeemed by partner user ID:', ev.giftCard.redeemedByPlatformUserId ?? '—');
      fieldRow(doc, 'Redeemed by email:', ev.giftCard.redeemedByEmail ?? '—');
    } else {
      doc.font('Helvetica').fontSize(9).fillColor('#666666').text('No gift card record found for this transaction.');
      doc.fillColor('#000000');
    }

    // Capture(s)
    if (ev.captures.length > 0) {
      sectionHeader(doc, 'Partner-Side Credit Capture(s)');
      doc.font('Helvetica').fontSize(9).text(
        'Records of the partner platform consuming the credit balance on the ' +
        'cardholder’s behalf to fund a specific pledge.',
      );
      doc.moveDown(0.3);
      ev.captures.forEach((c, i) => {
        if (i > 0) doc.moveDown(0.3);
        fieldRow(doc, `Capture #${i + 1} ID:`, c.id);
        fieldRow(doc, '  Amount:', formatMoney(c.amountCents, ev.currency));
        fieldRow(doc, '  Pledge ID:', c.pledgeId || '—');
        fieldRow(doc, '  Project ID:', c.projectId || '—');
        fieldRow(doc, '  Captured at:', formatDate(c.capturedAt));
      });
    }

    // Footer
    doc.moveDown(1.5);
    doc.fontSize(8).fillColor('#666666').font('Helvetica-Oblique').text(
      'This receipt confirms that DivinityCoin processed the digital-credit ' +
      'purchase described above and that the credit was delivered and redeemed ' +
      'as recorded. DivinityCoin sells only digital prepaid credits; physical ' +
      'merchandise, rewards, services, or other deliverables associated with a ' +
      'partner platform transaction are sold and fulfilled by the partner ' +
      'platform and/or the project creator, not by DivinityCoin. See our Terms ' +
      'of Service at divinitycoin.com/terms.',
      { align: 'justify' },
    );
  });
}

// ─── Chargeback response letter PDF ───────────────────────────────

export function generateResponsePdf(ev: DisputeEvidenceData, vrolCase?: string): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fillColor('#2563eb').fontSize(18).font('Helvetica-Bold').text('Divinity Payments');
    doc.fillColor('#000000').fontSize(9).font('Helvetica').text('DVCKS1 LLC dba DivinityCoin · divinitycoin.com · legal@divinitycoin.com');
    doc.moveDown(2);

    doc.fontSize(14).font('Helvetica-Bold').text('Chargeback Response — Compelling Evidence');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    doc.text(`Re: Disputed transaction ${ev.paymentIntentId ?? ev.internalId}, ${formatMoney(ev.amountCents, ev.currency)}, ${formatDate(ev.createdAt).slice(0, 10)}.`);
    if (vrolCase) doc.text(`VROL Case Number: ${vrolCase}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('1. What was purchased from DivinityCoin.');
    doc.moveDown(0.2);
    doc.font('Helvetica').text(
      `DivinityCoin (merchant descriptor reflecting the partner platform "DIVCO-${ev.partner?.slug?.toUpperCase() ?? '<PARTNER>'}") is a seller of digital prepaid gift cards / credits. ` +
      `The cardholder did not purchase physical merchandise from DivinityCoin. The product purchased in this transaction was ${formatMoney(ev.amountCents, ev.currency)} in DivinityCoin Credits — a digital prepaid credit balance — generated specifically to fund a pledge the cardholder placed on the partner platform ${ev.partner?.name ?? '<partner>'} (${ev.partner?.slug ?? ''}.com)` +
      (ev.pledgeId ? `, via pledge ID ${ev.pledgeId}` : '') +
      (ev.projectId ? ` / project ID ${ev.projectId}` : '') +
      '.',
      { align: 'justify' },
    );
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').text('2. DivinityCoin delivered the digital product in full.');
    doc.moveDown(0.2);
    if (ev.giftCard) {
      doc.font('Helvetica').text(
        `DivinityCoin Credits in the amount of ${formatMoney(ev.amountCents, ev.currency)} were generated on ${formatDate(ev.createdAt)} under gift card record ${ev.giftCard.id} (Code last 4: ****${ev.giftCard.codeLast4 ?? '----'}). ` +
        (ev.giftCard.redeemedAt
          ? `The credits were redeemed in full on ${formatDate(ev.giftCard.redeemedAt)} on the ${ev.giftCard.redeemedOnPlatform ?? ev.partner?.slug + '.com'} partner platform by platform user ${ev.giftCard.redeemedByPlatformUserId ?? ev.platformUserId ?? '<user>'}. `
          : '') +
        (ev.captures.length > 0
          ? `The credit balance was then captured by the partner platform (CreditCapture record ${ev.captures[0].id}) on ${formatDate(ev.captures[0].capturedAt)} and applied to pledge ${ev.captures[0].pledgeId} / project ${ev.captures[0].projectId}. `
          : '') +
        'From a merchant-of-record perspective, DivinityCoin’s product — the digital prepaid credit / gift card balance — was sold, delivered, redeemed, and consumed without exception, the same business day as the original charge.',
        { align: 'justify' },
      );
    } else {
      doc.font('Helvetica').text(
        'Records of credit issuance for this transaction are attached as raw-evidence.json.',
        { align: 'justify' },
      );
    }
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').text('3. The dispute concerns physical merchandise that is not — and could not be — supplied by DivinityCoin.');
    doc.moveDown(0.2);
    doc.font('Helvetica').text(
      'The cardholder’s stated grievance relates to physical merchandise pledged on a third-party crowdfunding partner platform. ' +
      'Physical fulfillment of pledged rewards is the responsibility of the project creator and the crowdfunding platform on which the pledge was placed. ' +
      'DivinityCoin is a gift card issuer and digital-credit seller and does not warehouse, ship, or otherwise fulfill physical merchandise. ' +
      'This is set out explicitly in our Terms of Service (sections 3 and 6) — DivinityCoin sells only digital prepaid credits, and physical merchandise, rewards, or services associated with a partner-platform transaction are sold and fulfilled by the partner platform and/or the underlying project creator. ' +
      'The proper channel for the cardholder’s complaint is the project creator and the partner platform’s backer-protection process, not the digital-credit transaction that DivinityCoin completed.',
      { align: 'justify' },
    );
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').text('4. Conclusion.');
    doc.moveDown(0.2);
    doc.font('Helvetica').text(
      `DivinityCoin delivered the digital prepaid gift-card / credit balance the cardholder purchased (${formatMoney(ev.amountCents, ev.currency)} in credits), and the cardholder demonstrably used that product on the partner platform the same business day. ` +
      'No DivinityCoin deliverable was withheld or undelivered. We respectfully request that the chargeback be reversed. DivinityCoin (DVCKS1 LLC) is a digital gift-card / prepaid-credit retailer; card processing is performed by Stripe Inc., our PCI-compliant payment processor.',
      { align: 'justify' },
    );
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('Attachments included in this evidence bundle:');
    doc.font('Helvetica').fontSize(9);
    doc.list([
      'receipt.pdf — formatted transaction receipt with delivery and redemption timeline',
      'raw-evidence.json — raw transaction record, gift card delivery + redemption record, partner-side credit capture record',
      'terms-snippet.txt — the relevant DivinityCoin Terms of Service sections (3 and 6)',
      'INSTRUCTIONS.md — step-by-step instructions for submitting this bundle to the dispute case',
    ]);
  });
}

// ─── Instructions markdown ────────────────────────────────────────

export function generateInstructions(ev: DisputeEvidenceData, vrolCase?: string): string {
  const piRef = ev.paymentIntentId ?? ev.internalId;
  return `# Dispute Evidence Bundle — Submission Instructions

Generated: ${new Date().toISOString()}
Transaction: ${piRef}
Cardholder email on file: ${ev.email ?? '(none)'}
Amount: ${formatMoney(ev.amountCents, ev.currency)}
${vrolCase ? `VROL Case Number: ${vrolCase}` : ''}

## What's in this bundle

| File | What it is |
|---|---|
| \`receipt.pdf\` | DivinityCoin internal record of gift-card generation, delivery, and redemption — formatted and time-stamped. Use as primary "service documentation". |
| \`stripe-payment-context.pdf\` | Stripe-side payment facts (card brand + last 4, charge ID, balance transaction, statement descriptor, receipt URL) pulled live from the Stripe API at bundle-generation time. |
| \`response-letter.pdf\` | The compelling-evidence cover letter for the dispute, pre-filled with this transaction's specifics. Use as the "customer communication" / "activity log" upload, or as a stand-alone cover letter if the issuer requests one. |
| \`terms-of-service.pdf\` | The chargeback-relevant excerpts (sections 3 and 6) of DivinityCoin's Terms of Service, formatted as a PDF. Shows the cardholder agreed at checkout that physical merchandise is the partner platform's deliverable, not ours. |
| \`raw-evidence.json\` | Raw database records (payment, gift card, redemption, partner capture) plus the Stripe context. Field-level reference / tie-breaker if the issuer wants to verify specifics. |

## Not in this bundle (request separately)

- **Partner-platform activity log** showing the funded pledge on the cardholder's account. DivinityCoin does not host this data — only the partner platform does. Request it from your partner contact (e.g. IndieCrowdfund's support@) and attach it as an additional file in Stripe's dispute UI if available.
- **Stripe-hosted receipt PDF**. We include the Stripe receipt *URL* in \`stripe-payment-context.pdf\`. To attach the original PDF receipt, open that URL in a browser and use "Save as PDF", then upload to Stripe's dispute UI alongside this bundle.

## How to submit (Stripe Dashboard)

1. Go to **https://dashboard.stripe.com/payments/${piRef}**
2. Click the disputed payment, then **"Counter dispute"** / **"Submit evidence"**.
3. Fill the Stripe evidence form like this:

   - **Product description**: *"Digital prepaid gift cards / credits ('DivinityCoin Credits') sold to the cardholder for use on partner platforms. The product purchased is a digital credit balance — no physical merchandise was sold by DivinityCoin in this transaction. DivinityCoin (DVCKS1 LLC) is a digital gift-card / prepaid-credit retailer; Stripe is the PCI-compliant payment processor we use."*
   - **Customer name / email**: \`${ev.email ?? '(see raw-evidence.json)'}\`
   - **Service date**: ${formatDate(ev.createdAt).slice(0, 10)}
   - **Receipt**: upload \`receipt.pdf\`.
   - **Service documentation**: upload \`terms-of-service.pdf\` (and \`stripe-payment-context.pdf\` in a second slot if available).
   - **Customer communication / activity log**: upload \`response-letter.pdf\` AND paste the body of that letter into the free-text "customer communication" field.
   - **Refund policy**: link to **https://divinitycoin.com/refunds**
   - **Shipping documentation**: leave blank — there was no physical shipment from DivinityCoin.
   - **Additional file**: upload \`raw-evidence.json\` if Stripe allows another slot, and the partner-platform activity log if you obtained one.

4. Submit. Stripe forwards to Visa within 24 hours.

## Quick facts for the issuer (Wells Fargo in the example case)

- Merchant of record: DVCKS1 LLC dba DivinityCoin
- Statement descriptor: ${ev.partner ? `DIVCO-${ev.partner.slug.toUpperCase()}` : 'DIVCO-<PARTNER>'}
- Partner platform: ${ev.partner?.name ?? '(none on file)'}
- Cardholder pledged on: ${ev.partner ? `${ev.partner.slug}.com` : '(see raw-evidence.json)'}
- DivinityCoin's product: digital credit balance (delivered ${formatDate(ev.createdAt).slice(0, 10)})
- Credit redeemed on partner platform: ${ev.giftCard?.redeemedAt ? formatDate(ev.giftCard.redeemedAt).slice(0, 10) : '(see receipt.pdf)'}

## After submitting

Forward a copy of this bundle to your partner platform contact so they know one of their backers is filing a chargeback against DC for what is actually their platform's fulfillment. They can pull their own creator-fulfillment logs in parallel.

---
Bundle generated by /admin/disputes at ${new Date().toISOString()}.
`;
}

// ─── Stripe-side payment context PDF ─────────────────────────────
// Pulls the live PaymentIntent from Stripe and renders the processor-side
// facts the issuer typically wants to verify: card brand + last 4, charge id,
// balance transaction id, statement descriptor, Stripe receipt URL, etc.

interface StripeContextSummary {
  paymentIntentId: string;
  status: string;
  amountCents: number;
  currency: string;
  livemode: boolean;
  customerId: string | null;
  chargeId: string | null;
  balanceTransactionId: string | null;
  receiptUrl: string | null;
  receiptEmail: string | null;
  statementDescriptor: string | null;
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    funding: string | null;
    country: string | null;
    network: string | null;
  } | null;
  createdAt: Date;
  errorMessage?: string;
}

async function fetchStripeContext(paymentIntentId: string): Promise<StripeContextSummary | null> {
  try {
    const stripe = await getStripeClient();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge', 'latest_charge.balance_transaction', 'latest_charge.payment_method_details'],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge: any = pi.latest_charge;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pmd: any = charge?.payment_method_details ?? null;
    return {
      paymentIntentId: pi.id,
      status: pi.status,
      amountCents: pi.amount,
      currency: pi.currency,
      livemode: pi.livemode,
      customerId: typeof pi.customer === 'string' ? pi.customer : (pi.customer?.id ?? null),
      chargeId: charge?.id ?? null,
      balanceTransactionId: typeof charge?.balance_transaction === 'string'
        ? charge.balance_transaction
        : (charge?.balance_transaction?.id ?? null),
      receiptUrl: charge?.receipt_url ?? null,
      receiptEmail: charge?.receipt_email ?? pi.receipt_email ?? null,
      statementDescriptor: charge?.statement_descriptor
        ?? charge?.statement_descriptor_suffix
        ?? pi.statement_descriptor
        ?? null,
      card: pmd?.card ? {
        brand: pmd.card.brand ?? 'unknown',
        last4: pmd.card.last4 ?? '----',
        expMonth: pmd.card.exp_month ?? 0,
        expYear: pmd.card.exp_year ?? 0,
        funding: pmd.card.funding ?? null,
        country: pmd.card.country ?? null,
        network: pmd.card.network ?? null,
      } : null,
      createdAt: new Date((pi.created ?? Math.floor(Date.now() / 1000)) * 1000),
    };
  } catch (error) {
    logger.warn('Failed to fetch Stripe context for dispute bundle', {
      paymentIntentId,
      error: error instanceof Error ? error.message : error,
    });
    return {
      paymentIntentId,
      status: 'unknown',
      amountCents: 0,
      currency: 'usd',
      livemode: false,
      customerId: null,
      chargeId: null,
      balanceTransactionId: null,
      receiptUrl: null,
      receiptEmail: null,
      statementDescriptor: null,
      card: null,
      createdAt: new Date(),
      errorMessage: error instanceof Error ? error.message : 'Lookup failed',
    };
  }
}

export function generateStripeContextPdf(ctx: StripeContextSummary): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fillColor('#2563eb').fontSize(20).font('Helvetica-Bold').text('Divinity Payments');
    doc.fillColor('#000000').fontSize(9).font('Helvetica').text('DVCKS1 LLC dba DivinityCoin · divinitycoin.com');
    doc.moveDown(0.5);
    doc.fontSize(16).font('Helvetica-Bold').text('Stripe Payment-Context Sheet');
    doc.fontSize(9).fillColor('#666666').font('Helvetica').text(
      `Generated ${formatDate(new Date())}   ·   Sourced from Stripe API ${ctx.errorMessage ? '(LOOKUP FAILED)' : 'live'}`,
    );
    doc.fillColor('#000000');

    if (ctx.errorMessage) {
      doc.moveDown(1);
      doc.fillColor('#dc2626').fontSize(10).font('Helvetica-Bold').text(`Stripe lookup error: ${ctx.errorMessage}`);
      doc.fillColor('#000000');
    }

    sectionHeader(doc, 'PaymentIntent');
    fieldRow(doc, 'PaymentIntent ID:', ctx.paymentIntentId);
    fieldRow(doc, 'Status:', ctx.status);
    fieldRow(doc, 'Amount:', `${formatMoney(ctx.amountCents, ctx.currency)} (${ctx.amountCents} cents)`);
    fieldRow(doc, 'Currency:', ctx.currency.toUpperCase());
    fieldRow(doc, 'Created (Stripe):', formatDate(ctx.createdAt));
    fieldRow(doc, 'Live mode:', ctx.livemode ? 'yes' : 'no (test)');
    fieldRow(doc, 'Stripe customer ID:', ctx.customerId ?? '—');
    fieldRow(doc, 'Statement descriptor:', ctx.statementDescriptor ?? '—');

    sectionHeader(doc, 'Card Payment Method');
    if (ctx.card) {
      fieldRow(doc, 'Brand:', ctx.card.brand.toUpperCase());
      fieldRow(doc, 'Last 4:', `****${ctx.card.last4}`);
      fieldRow(doc, 'Expiry:', `${String(ctx.card.expMonth).padStart(2, '0')}/${ctx.card.expYear}`);
      fieldRow(doc, 'Funding:', ctx.card.funding ?? '—');
      fieldRow(doc, 'Card country:', ctx.card.country ?? '—');
      fieldRow(doc, 'Network:', ctx.card.network ?? '—');
    } else {
      doc.font('Helvetica').fontSize(9).fillColor('#666666').text('No card details available from Stripe.');
      doc.fillColor('#000000');
    }

    sectionHeader(doc, 'Charge & Settlement');
    fieldRow(doc, 'Charge ID:', ctx.chargeId ?? '—');
    fieldRow(doc, 'Balance transaction ID:', ctx.balanceTransactionId ?? '—');
    fieldRow(doc, 'Receipt email:', ctx.receiptEmail ?? '—');
    fieldRow(doc, 'Stripe receipt URL:', ctx.receiptUrl ?? '—');

    doc.moveDown(1.5);
    doc.fontSize(8).fillColor('#666666').font('Helvetica-Oblique').text(
      'This sheet summarizes Stripe-side facts about the disputed PaymentIntent for ' +
      'cross-reference by the card issuer. The Stripe-hosted receipt for the ' +
      'cardholder is available at the Stripe receipt URL above; you can also ' +
      'download it as a PDF directly from the Stripe Dashboard if the issuer ' +
      'requires the original receipt format.',
      { align: 'justify' },
    );
  });
}

// ─── Terms snippet ───────────────────────────────────────────────

export function termsSnippet(): string {
  return `DivinityCoin Terms of Service — chargeback-relevant excerpts
=============================================================

(Full Terms: https://divinitycoin.com/terms)

----- Section 3. Service Description -----

DivinityCoin provides a digital credit purchase service. Users can purchase
credits that can be redeemed on partner platforms to support creators and
content providers. We act as an intermediary between purchasers and partner
platforms. The credits purchased through our Service function similarly to
gift cards or stored value cards under applicable Indiana and federal law.

Nature of Our Product. DivinityCoin sells, exclusively, digital prepaid
credits. We do not sell, manufacture, ship, deliver, warehouse, or otherwise
fulfill any physical merchandise, tangible goods, services, rewards,
experiences, or other deliverables of any kind. Any physical merchandise,
rewards, perks, experiences, or services offered, advertised, pledged, or
promised through, on, or in connection with a partner platform — including
but not limited to crowdfunding rewards, backer perks, retail goods, digital
downloads outside the credit balance itself, subscriptions, or any
creator-fulfilled deliverable — are sold and fulfilled by that partner
platform and/or the underlying project creator, not by DivinityCoin.
DivinityCoin's product, and DivinityCoin's sole deliverable to you in any
transaction, is the digital credit balance itself. The credit balance is
deemed delivered and our performance is deemed complete upon issuance of the
credit code (or, where the credits are issued and consumed automatically as
part of a partner platform transaction, upon successful application of the
credit balance to that partner platform transaction).

----- Section 6. Redemption -----

Credits are redeemed on partner platforms according to their respective terms
and conditions. DivinityCoin is not responsible for the services, content,
availability, or policies of partner platforms. Once credits are redeemed to
a partner platform, any disputes regarding the use of those credits must be
resolved with the partner platform directly.

Physical Merchandise, Rewards, and Services. Any physical merchandise,
tangible goods, services, experiences, rewards, perks, or other non-credit
deliverables offered, advertised, pledged, or promised through a partner
platform (including but not limited to crowdfunding pledges and backer
rewards) are sold and fulfilled by the partner platform and/or the
underlying project creator, and not by DivinityCoin. DivinityCoin's only
obligation in any transaction is the delivery and successful redemption of
the digital credit balance. Any dispute, complaint, claim, or chargeback
concerning the non-delivery, late delivery, partial delivery, condition,
quality, shipping, fulfillment, cancellation, or non-performance of physical
merchandise, rewards, or services associated with a partner-platform
transaction must be pursued against the partner platform and/or the project
creator. DivinityCoin will not refund, replace, reverse, or otherwise be
liable for the non-delivery or non-performance of any physical merchandise,
rewards, or services that are not, and have never been, our deliverable. The
cardholder's remedy for any such non-delivery is with the partner platform
and creator, not with DivinityCoin.
`;
}

// ─── Terms-of-Service excerpt PDF ────────────────────────────────

export function generateTermsPdf(): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.fillColor('#2563eb').fontSize(20).font('Helvetica-Bold').text('Divinity Payments');
    doc.fillColor('#000000').fontSize(9).font('Helvetica').text('DVCKS1 LLC dba DivinityCoin · divinitycoin.com/terms');
    doc.moveDown(0.5);
    doc.fontSize(16).font('Helvetica-Bold').text('Terms of Service — chargeback-relevant excerpts');
    doc.fontSize(9).fillColor('#666666').font('Helvetica').text(`Generated ${formatDate(new Date())} from divinitycoin.com/terms (last updated June 2026)`);
    doc.fillColor('#000000');

    sectionHeader(doc, 'Section 3 — Service Description');
    doc.font('Helvetica').fontSize(10).text(
      'DivinityCoin provides a digital credit purchase service. Users can purchase ' +
      'credits that can be redeemed on partner platforms to support creators and ' +
      'content providers. We act as an intermediary between purchasers and partner ' +
      'platforms. The credits purchased through our Service function similarly to ' +
      'gift cards or stored value cards under applicable Indiana and federal law.',
      { align: 'justify' },
    );
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Nature of Our Product. ', { continued: true });
    doc.font('Helvetica').text(
      'DivinityCoin sells, exclusively, digital prepaid credits. We do not sell, ' +
      'manufacture, ship, deliver, warehouse, or otherwise fulfill any physical ' +
      'merchandise, tangible goods, services, rewards, experiences, or other ' +
      'deliverables of any kind. Any physical merchandise, rewards, perks, ' +
      'experiences, or services offered, advertised, pledged, or promised through, ' +
      'on, or in connection with a partner platform — including but not limited to ' +
      'crowdfunding rewards, backer perks, retail goods, digital downloads outside ' +
      'the credit balance itself, subscriptions, or any creator-fulfilled deliverable ' +
      '— are sold and fulfilled by that partner platform and/or the underlying ' +
      'project creator, not by DivinityCoin. DivinityCoin’s product, and ' +
      'DivinityCoin’s sole deliverable to you in any transaction, is the digital ' +
      'credit balance itself. The credit balance is deemed delivered and our ' +
      'performance is deemed complete upon issuance of the credit code (or, where ' +
      'the credits are issued and consumed automatically as part of a partner ' +
      'platform transaction, upon successful application of the credit balance to ' +
      'that partner platform transaction).',
      { align: 'justify' },
    );

    sectionHeader(doc, 'Section 6 — Redemption');
    doc.font('Helvetica').fontSize(10).text(
      'Credits are redeemed on partner platforms according to their respective ' +
      'terms and conditions. DivinityCoin is not responsible for the services, ' +
      'content, availability, or policies of partner platforms. Once credits are ' +
      'redeemed to a partner platform, any disputes regarding the use of those ' +
      'credits must be resolved with the partner platform directly.',
      { align: 'justify' },
    );
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Physical Merchandise, Rewards, and Services. ', { continued: true });
    doc.font('Helvetica').text(
      'Any physical merchandise, tangible goods, services, experiences, rewards, ' +
      'perks, or other non-credit deliverables offered, advertised, pledged, or ' +
      'promised through a partner platform (including but not limited to ' +
      'crowdfunding pledges and backer rewards) are sold and fulfilled by the ' +
      'partner platform and/or the underlying project creator, and not by ' +
      'DivinityCoin. DivinityCoin’s only obligation in any transaction is the ' +
      'delivery and successful redemption of the digital credit balance. Any ' +
      'dispute, complaint, claim, or chargeback concerning the non-delivery, late ' +
      'delivery, partial delivery, condition, quality, shipping, fulfillment, ' +
      'cancellation, or non-performance of physical merchandise, rewards, or ' +
      'services associated with a partner-platform transaction must be pursued ' +
      'against the partner platform and/or the project creator. DivinityCoin will ' +
      'not refund, replace, reverse, or otherwise be liable for the non-delivery ' +
      'or non-performance of any physical merchandise, rewards, or services that ' +
      'are not, and have never been, our deliverable. The cardholder’s remedy ' +
      'for any such non-delivery is with the partner platform and creator, not ' +
      'with DivinityCoin.',
      { align: 'justify' },
    );

    doc.moveDown(1);
    doc.fontSize(8).fillColor('#666666').font('Helvetica-Oblique').text(
      'Full Terms of Service available at https://divinitycoin.com/terms. ' +
      'DivinityCoin is operated by DVCKS1 LLC, an Indiana limited liability company.',
      { align: 'justify' },
    );
  });
}

// ─── Bundle assembly ─────────────────────────────────────────────

export async function buildEvidenceBundle(
  idOrPi: string,
  vrolCase?: string,
): Promise<{ zip: Buffer; filename: string; evidence: DisputeEvidenceData } | null> {
  const evidence = await gatherDisputeEvidence(idOrPi);
  if (!evidence) return null;

  // Pull Stripe-side context in parallel with PDF generation (only if
  // we actually have a Stripe PaymentIntent id to look up).
  const stripeCtxPromise = evidence.paymentIntentId
    ? fetchStripeContext(evidence.paymentIntentId)
    : Promise.resolve(null);

  const [receiptBuf, responseBuf, termsBuf, stripeCtx] = await Promise.all([
    generateReceiptPdf(evidence),
    generateResponsePdf(evidence, vrolCase),
    generateTermsPdf(),
    stripeCtxPromise,
  ]);
  const stripeCtxBuf = stripeCtx ? await generateStripeContextPdf(stripeCtx) : null;

  const zip = new JSZip();
  zip.file('INSTRUCTIONS.md', generateInstructions(evidence, vrolCase));
  zip.file('receipt.pdf', receiptBuf);
  zip.file('response-letter.pdf', responseBuf);
  zip.file('terms-of-service.pdf', termsBuf);
  if (stripeCtxBuf) zip.file('stripe-payment-context.pdf', stripeCtxBuf);
  zip.file(
    'raw-evidence.json',
    JSON.stringify(
      { vrolCase: vrolCase ?? null, evidence, stripeContext: stripeCtx },
      (key, value) => {
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'bigint') return value.toString();
        return value;
      },
      2,
    ),
  );

  const buf = await zip.generateAsync({ type: 'nodebuffer' });

  const filename = `dispute-evidence-${(evidence.paymentIntentId ?? evidence.internalId).replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;

  logger.info('Dispute evidence bundle generated', {
    paymentIntentId: evidence.paymentIntentId,
    internalId: evidence.internalId,
    source: evidence.source,
    bundleSize: buf.length,
  });

  return { zip: buf, filename, evidence };
}
