/**
 * Canonical definition of Relay's product. This is authoritative ground truth
 * injected into every prompt that talks about Relay (strategy pre-fill and copy
 * generation) so the model never invents what Relay does. Relay is NOT an ad
 * agency or traffic service — it's a creator-content subscription — and the
 * "WHAT RELAY IS NOT" guardrails exist to stop that specific hallucination.
 */

export const RELAY_PRODUCT = `WHAT RELAY IS (authoritative — do not contradict, soften, or invent beyond this):
Relay is a monthly subscription for local businesses — independent restaurants, cafés, bars, and food spots. It costs $99 per month.

Every month, a vetted local creator comes in, samples the menu, and creates authentic content about the business — reels, stories, and photos — and posts about it. All of that content belongs to the business: theirs to keep and reuse forever, anywhere they want.

The owner does nothing hands-on — they don't film, script, schedule, edit, or manage anything. One simple subscription gives them a steady stream of real, local creator content every month.

THE OWNER'S PROBLEM Relay solves: independent owners want to fill their seats and keep their marketing going, but they have no time, no fresh content, and no patience for managing it all.

RELAY'S PROMISE: a fresh batch of authentic local creator content every month — made for them, owned by them — for $99/month.

WHAT RELAY IS NOT (never state or imply any of these):
- Relay is NOT an ad agency or an ad-management service.
- Relay does NOT run the owner's ads, build or manage campaigns, or handle ad spend.
- Relay does NOT drive traffic to a menu, website, or reservation system, and does NOT do SEO.
- Do NOT promise specific customer numbers, more diners, revenue, sales, or any guaranteed result. Relay delivers content; what the owner does with it is up to them.`;
