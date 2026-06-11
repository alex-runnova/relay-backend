/**
 * Canonical Relay knowledge — authoritative ground truth injected into every
 * prompt that talks about Relay (strategy pre-fill + copy generation), so the
 * model never invents what Relay does. Sourced from the NOVA × Relay creative
 * brief. Relay is NOT an ad agency or traffic service — it's a creator-content
 * subscription — and the "WHAT RELAY IS NOT" guardrails stop that hallucination.
 */

export const RELAY_PRODUCT = `WHAT RELAY IS (authoritative — do not contradict, soften, or invent beyond this):
Relay is a monthly subscription that gets local businesses authentic creator content — done for them, owned by them. It is $99/month, and the FIRST creator visit is FREE (the first month is free; no card, no commitment to claim it).

Every month, a vetted local creator comes in and — completely hands-off for the owner —:
- shoots one Reel or TikTok,
- posts same-day Stories,
- hands over three commercial-use photos the business keeps and reuses forever,
- and leaves one Google review.
Every month, on autopilot. The owner never briefs, films, edits, schedules, or manages anything.

WHO RELAY TALKS TO:
Owner-operators of local small businesses (roughly $300K–$3M in revenue) who STILL touch marketing decisions themselves — not a marketing director, not a CFO. Verticals: restaurants, cafés, bars, salons, barbers, fitness studios, wellness, med spas, entertainment. Meet the operator still running the floor, not the org chart above them.

POSITIONING (this is the whole game):
- Talk to the OWNER, not the boardroom. Plain, grounded, local language. Never corporate marketing-speak ("retail activation", "omnichannel", "brand strategy", "engagement", "synergy").
- The real competitor is INACTION, not another platform. Every ad's one job: make doing nothing feel more expensive than a free first visit.
- Sell the PEACE OF MIND, not the product. The feeling to land is "no extra work", "on autopilot", "handed off".
- Verified proof you MAY cite: 87% of businesses who try Relay come back after their first creator visit. (In Pittsburgh, Relay has spent 24 months building creator-driven word-of-mouth — cite the Pittsburgh history only for Pittsburgh.)

KNOWN OBJECTIONS to disarm (don't argue — reframe):
- "I post my own content already." → Show the gap between pro creator content and DIY; let the comparison speak.
- "I tried an influencer once, it didn't work." → Relay is vetted, coordinated, and consistent, month after month — not a one-off.
- "$99 feels too cheap / is this a scam?" → Lean on the free first visit and real results.
- "That's not that many followers." → A hyperlocal creator beats a macro-influencer for real foot traffic — faces people recognize, voices they trust.

WHAT RELAY IS NOT (never state or imply any of these):
- NOT an ad agency or ad-management service; does NOT run the owner's ads, build or manage campaigns, or handle ad spend.
- Does NOT drive traffic to a menu, website, or reservation system, and does NOT do SEO.
- Do NOT promise specific customers, diners, foot traffic numbers, revenue, or guaranteed results beyond the cited "87% come back" stat. Relay delivers content and word-of-mouth; outcomes are not guaranteed.`;

/**
 * The three acquisition messaging angles from the creative brief. Each maps to
 * its own landing page. Used to steer copy toward the angle the brief selects.
 */
export const ANGLE_GUIDE = `THE THREE MESSAGING ANGLES (each maps to its own landing page):
1. social_proof — "Your peers are already doing this." Make inaction feel costly WITHOUT putting the owner on the defensive — the owner who hasn't heard of Relay just hasn't been told yet. Example headlines: "The business next door is already on the list." / "Pittsburgh businesses are already doing this. Is yours?"
2. time_relief — "You don't have time. We do." Meet owners who know they should post but have no time. Sell the RELIEF of handing it off, not the effort. Example headlines: "You don't have time to post. We get it — that's exactly why we built this." / "Running a business is already a full-time job. Your content shouldn't be another one."
3. value — "Easier & cheaper than you think." Remove the last excuse, for owners who already know Relay exists. Example headlines: "This isn't DIY creator marketing." / "Cheaper than a single sponsored post. More useful than a one-off shoot."`;
