// lib/partner/internal-actions.ts
// The action names /internal accepts, in one place so the route's own error
// responses and the /api/internal signpost cannot drift apart from each other
// or from the handlers.

export const INTERNAL_POST_ACTIONS = [
  'validate', 'balance', 'hold', 'release', 'capture',
  'create-payment-intent', 'create-checkout-session', 'get-checkout-session',
  'refund', 'verify-payment', 'lookup-payment',
  'create-setup-intent', 'get-setup-intent', 'list-payment-methods',
  'detach-payment-method', 'charge-saved-payment-method',
] as const;

export const INTERNAL_GET_ACTIONS = [
  'health', 'settlements', 'settlement', 'captures',
] as const;

/**
 * Body for an unrecognised or missing `action`. Names what was received and
 * what is accepted: "Invalid action" alone left a partner with nothing to act
 * on but guesswork.
 */
export function invalidActionBody(
  method: 'GET' | 'POST',
  received: string | null,
  origin: string,
) {
  const valid = method === 'POST' ? INTERNAL_POST_ACTIONS : INTERNAL_GET_ACTIONS;
  return {
    error: received
      ? `Unknown action "${received}" for ${method} /internal.`
      : `Missing required "action" query parameter on ${method} /internal.`,
    validActions: valid,
    example: `${origin}/internal?action=${valid[0]}`,
    documentation: `${origin}/developers`,
  };
}
