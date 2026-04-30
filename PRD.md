# Direkta — Product Requirements Document

**Version:** 1.2 | **Status:** Engineering Handover | **Date:** 2026-04-30
**Market:** Germany (DE) | **Compliance:** GDPR, GwG, GEG, TTDSG
**Property Scope:** ETW, EFH, MFH (up to 4 units), DHH, RH, Grundstueck
**Source spec:** Direkta_Lastenheft_Pflichtenheft_v1_2.docx

---

## 1. Vision & Hypothesis

Direkta is a software platform that enables German property owners to sell their real estate themselves — faster, more transparently, and at a lower cost than a traditional Makler.

**Single MVP hypothesis:**

> "Property owners can use Direkta to sell their property themselves — faster or cheaper than with a traditional agent — without needing to understand the real estate process."

Everything in scope serves this hypothesis. Anything that does not measurably contribute to time-to-sale, achieved sale price, or cost saved versus an agent is out of scope.

**What Direkta is NOT:**
- Not a property portal (we don't aggregate listings for buyers)
- Not an iBuyer (we don't buy property)
- Not a valuation tool (valuation is a feature, not the product)
- Not an AI writing assistant (AI is plumbing, the product is the sales process)
- Not a two-sided marketplace

### Positioning Statement

> "Direkta is for property owners who want to sell their home without surrendering 3.57% to an agent — but who also want a guided, professional process they can trust. We are not a listing portal. We are not a marketplace. We are a software-driven sales process that replaces the agent."

### Long-Term Vision (Post-MVP Moat)

These capabilities are explicitly **out of scope for the MVP** but inform architectural decisions today: **the data model MUST be designed so this future is not blocked.**

- **Transaction data:** every closed sale produces a verified `(property attributes → final price → time-to-sale)` data point. More accurate than any portal's listing data, which only knows asking prices.
- **Buyer graph:** Direkta sees which buyers actually close, at what price, with what financing, and how long it took. A unique buyer-quality signal.
- **Pricing intelligence:** with sufficient transaction volume, Direkta's price recommendation outperforms agent intuition in any micro-market.
- **Adjacent products:** notary integration, financing brokerage, post-sale services, energy certificates.

---

## 2. Problem Statement

### Market Size

The German residential market sees roughly **800,000–1,000,000 ownership transactions per year** across all property types, with a total transaction volume in the order of **EUR 200–250 billion**. The dominant intermediary is the Makler, historically charging **5.95–7.14% in total commission** split between buyer and seller. Since the **Bestellerprinzip reform of December 2020**, residential commissions must be split roughly equally between buyer and seller, but absolute amounts have not declined.

In Germany, a typical Maklerprovision of **3.57%** (incl. VAT, seller-side) on a EUR 500,000 property costs the seller roughly **EUR 17,850**. Yet over **70% of residential transactions** still go through agents — not because agents provide proportional value, but because the process is complex:

- Owners don't know how to price correctly
- They can't write a legally compliant listing (GEG, Energieausweis)
- They can't filter serious buyers from time-wasters
- They don't know how to move a deal safely toward the notary

**Direkta closes that gap with software.**

Two structural shifts make this viable now:
1. Sellers start their journey on portals (IS24, Immowelt) — the first 30 minutes of intent are digital
2. LLM-grade text generation has collapsed the cost of professional listings from hundreds of euros to single-digit cents

---

## 3. Competitive Landscape

| Category | Examples | Their Offer | Where Direkta Wins |
|---|---|---|---|
| Traditional Makler | Engel & Voelkers, Von Poll | Full-service, 3.57% commission | 90% cheaper, full transparency |
| Hybrid online brokers | McMakler, Homeday | Reduced fee, central agent pool | True self-serve, no call centre |
| Listing portals | ImmoScout24, Immowelt | Distribution only | Direkta does the agent's work on top |
| DIY private sale | PDF/Word/Excel | Free but high effort, low quality | Comparable cost, drastically higher quality |

---

## 4. Target Users & Personas

### 4.1 Primary Customer: The Seller

Direkta has **one paying customer**: the property owner who wants to sell. Buyers are users, not customers. This distinction is enforced in pricing, support, conflict resolution, and product trade-offs.

| Archetype | Profile | Trigger | Why Direkta |
|---|---|---|---|
| **A — Estate Seller** | Heir, 45-65, inherited property, often remote | Inheritance, tax deadline, Erbengemeinschaft | Low effort, geographic independence, no commission on emotional asset |
| **B — Upgrader** | Family, 35-50, selling to buy bigger | Family growth, remote work | Speed, timing control, retain commission for down payment |
| **C — Downsizer** | Empty-nester/retiree, 55-75 | Children moved out, mobility | Trust through transparency, understands every step |
| **D — Investor** | Rental property owner, 40-65 | Portfolio rebalancing, tax exit | Cost-driven, calculates savings vs. own time |

MVP conversion and onboarding flows are optimised for **Archetypes A and B**.

### 4.2 Jobs To Be Done

1. "Help me figure out what my property is worth — and prove it to me."
2. "Help me create a listing that doesn't look amateurish, without me writing it."
3. "Filter out tyre-kickers so I only spend time on serious buyers."
4. "Tell me which offer to take and why."
5. "Get me to the notary without surprises."

### 4.3 Trust Barriers

| Barrier | How Direkta Addresses It |
|---|---|
| "What if I price it wrong?" | Transparent comparables + three explicit pricing strategies |
| "What if I miss a legal requirement?" | Compliance checklist blocks publishing until satisfied |
| "What if a buyer wastes my time?" | Auto-qualification before any human contact |
| "What if an offer is a scam?" | Offer dashboard with risk scoring + identity verification |
| "What if something goes wrong and I'm alone?" | Optional human-support escalation lane |

### 4.4 Secondary User: The Buyer

Buyers are not paying customers but directly affect seller outcomes. Requirements:
- Frictionless enquiry in under 60 seconds, no account required
- Accurate, GEG-compliant property data
- Automated acknowledgement within 5 minutes, qualified next step within 24 hours
- Privacy: enquiries not sold, syndicated or used for advertising

### 4.5 ICP for Go-to-Market (First 100 Listings)

- **Property type:** EFH, ETW, small MFH (up to 4 units)
- **Price band:** EUR 200,000 - EUR 1,200,000
- **Geography:** Top-30 German cities and commuter belts
- **Seller profile:** Archetypes A and B

The product must not technically restrict outside this ICP — the constraint is on marketing spend.

---

## 5. Customer Journey Comparison

### With Direkta vs. Without

| Phase | Without Direkta | With Direkta | Time Saved |
|---|---|---|---|
| Onboarding | 2-3 wks: research agents, meet 3-5, sign Maklervertrag | Day 1: sign up + Expose Agent dialog (15-20 min) | ~3 weeks |
| Listing prep | 2-3 wks: agent's photo schedule, generic Expose | Day 1-2: AI-drafted Expose, seller edits, compliance check | ~2 weeks |
| Pricing | Set by agent, opaque, biased toward fast close | Three explicit strategies with comparables | More clarity |
| Distribution | 1-2 wks: agent posts on portals on their schedule | Day 2: auto-syndication to IS24 within 30 min | ~1-2 weeks |
| Lead handling | Filtered through agent, seller has no view | Auto-qualified, ranked by score, visible in inbox | Full transparency |
| Negotiation | 4-6 wks indirect back-and-forth via agent | Structured offers, scored, compared side-by-side | ~3-4 weeks |
| Closing | 2 wks: agent prepares notary appointment | 1-click accept, auto-generated notary package | ~1 week |

**Total: ~20 weeks / EUR 17,850 commission vs. ~8 weeks / EUR 999 flat fee**

### Where Direkta Is Honestly Weaker
- In-person hand-holding (good local Makler offers human reassurance)
- Network for off-market deals (agents have private buyer networks)
- Highly atypical properties (heritage, agricultural, complex inheritance)

### Visual Journey Map

A high-resolution side-by-side journey map is provided as a separate asset (`Direkta_CustomerJourney.png`) in the repository root. It visualises both paths on a single page: the upper lane shows the traditional Makler path (~20 weeks, ~EUR 17,850 commission) with explicit pain markers; the lower lane shows the Direkta path (~8 weeks, EUR 999 flat fee). The dark band at the bottom quantifies the four key advantages — ~12 weeks faster, ~EUR 16,851 saved, full transparency, and geographic freedom. Use in pitch decks, investor materials, and sales collateral.

---

## 6. Product Scope — Six Core Modules

### M1 — Smart Listing Creation

**Goal:** Seller arrives with photos and basic facts, leaves with a complete, legally compliant, professional listing in under 15 minutes.

**Inputs:**
- Property address (validated against address API)
- Property type (ETW, EFH, MFH, DHH, RH, Grundstueck)
- Living area, plot area, year built, rooms, bathrooms, floor
- Condition (5-point scale: Erstbezug, gepflegt, renovierungsbeduerftig, sanierungsbeduerftig, Rohbau/Neubau)
- Energieausweis (PDF upload or manual entry)
- Photos (min 6, recommended 12, max 30, JPEG/PNG, max 25MB each)
- Optional: floor plan, renovations, special features

**Outputs:**
- Structured property record in database
- AI-generated German description (250-600 words, three paragraphs)
- AI-generated short summary (max 160 chars for portals)
- Enhanced photos (perspective, white balance, brightness — never AI-fabricated content)
- Compliance check: GEG fields, Energieausweis, min photos. **Publishing blocked until green.**

**Key Requirements:**

| ID | Pri | Requirement | Acceptance Criterion |
|---|---|---|---|
| F-M1-01 | MUST | Validate address against German address provider | Resolves to (lat, lng, postcode, city, street, number) |
| F-M1-02 | MUST | Support ETW, EFH, MFH (4 units), DHH, RH, Grundstueck | Each type renders correct input form |
| F-M1-03 | MUST | Accept Energieausweis by structured input OR PDF upload | PDF extracts: type, validity, energy class, kWh value |
| F-M1-04 | MUST | Accept 6-30 photos, JPEG/PNG, max 25MB | Rejects out-of-range with clear error |
| F-M1-05 | MUST | Auto-enhance photos without altering content | Never add, remove, or modify objects |
| F-M1-06 | MUST | Generate description + summary in under 30 seconds | Median < 30s across 50 test listings |
| F-M1-07 | MUST | Seller can edit all AI text before publishing | Edits persist; regeneration doesn't overwrite |
| F-M1-08 | MUST | Compliance check blocks publish on failure | Missing Energieausweis/GEG/photos blocks publish |
| F-M1-09 | SHOULD | Display quality score (0-100) for listing | Updates live above publish button |

**AI Capability A — Listing Text Generation (Provider Contract)**

LLM is wrapped behind an internal interface so the underlying model can be swapped without touching product code.

```typescript
interface TextGenerationProvider {
  generateLongDescription(input: PropertyDescriptionInput): Promise<string>;
  generateShortSummary(input: PropertyDescriptionInput): Promise<string>;
}

type PropertyDescriptionInput = {
  type: PropertyType;
  livingArea: number;
  rooms: number;
  bathrooms: number;
  yearBuilt?: number;
  condition: PropertyCondition;
  city: string;
  postcode: string;
  attributes: string[];        // ['balcony', 'fireplace', 'garage']
  energyClass: string;
  energyValue: number;
  highlights: string[];        // seller-provided
};
```

**Constraints:**
- Output language: German, formal Sie-form, neutral marketing tone
- Long description: 250–600 words, three paragraphs (property, surroundings, opportunity)
- Short summary: max 160 characters, no exclamation marks, includes type/rooms/area/city
- MUST NOT invent attributes not present in the structured input. The system MUST reject and regenerate any output containing unverifiable claims
- MUST end with a standard disclaimer about Energieausweis values

### M2 — Pricing Engine

**Goal:** Defensible price recommendation with three strategy variants.

**Inputs:**
- Structured property record from M1
- Comparable transactions within configurable radius and time window
- Local market trend data (EUR/sqm over 24 months for postcode)

**Outputs:**
- Recommended price band (low / median / high)
- Three presets: **Quick Sale** (5th percentile), **Realistic** (median), **Maximum** (90th percentile)
- Anonymised comparable transactions with similarity scores (min 5, max 20)
- Confidence indicator (high/medium/low)

**Out of scope for MVP:** ML models trained on proprietary data. The MVP uses a **transparent, rule-based pricing function**. The seller must understand why a number was suggested.

| ID | Pri | Requirement | Acceptance Criterion |
|---|---|---|---|
| F-M2-01 | MUST | Produce price band for any complete property record | 100% of records get band within 10 seconds |
| F-M2-02 | MUST | Three strategy presets with target prices | All render with numeric targets and time-to-sale |
| F-M2-03 | MUST | Display comparable transactions used | Min 5, max 20, with similarity scores |
| F-M2-04 | MUST | Display confidence indicator | High: >=10 comparables within 1km/12mo; Low: <3 |
| F-M2-05 | MUST | Pricing is deterministic and re-derivable | Same inputs = identical price band |
| F-M2-06 | MUST | Seller can override recommended price | Override logged, surfaced in offer dashboard |
| F-M2-07 | SHOULD | Track local market trends per postcode | EUR/sqm 24-month trend chart on pricing screen |

### M3 — Lead Funnel & Qualification

**Goal:** Capture buyer interest, auto-separate serious from noise, let seller schedule viewings.

**Capture surfaces:**
- Unique landing page per property at `direkta.de/{slug}` or `{city}.direkta.de/{slug}`
- Enquiry form on landing page (name, email, phone optional, message)
- Inbound forwarding from portals (unique email per listing, Direkta parses)

**Qualification flow:**
Each enquiry triggers automated follow-up: three structured questions (budget, financing status, timing). Answers scored as **Lead Quality Score (0-100)**.

**Lead Quality Score formula:**
```
25 * (financing in [CASH, PRE_APPROVED] ? 1 : 0)
+ 25 * (financing == IN_PROCESS ? 0.6 : 0)
+ 25 * (timing in [IMMEDIATELY, WITHIN_3M] ? 1 : 0)
+ 25 * (timing == WITHIN_6M ? 0.6 : 0)
+ 15 * (budget != null && budget >= askingPrice * 0.85 ? 1 : 0)
+ 10 * (phone != null ? 1 : 0)
- 20 * (replyContainsRedFlags ? 1 : 0)
// clamped to 0..100
```

| ID | Pri | Requirement | Acceptance Criterion |
|---|---|---|---|
| F-M3-01 | MUST | Unique SEO-friendly landing page per listing | URL: `/immobilien/{city-slug}/{property-slug}-{shortid}` |
| F-M3-02 | MUST | GEG-mandatory fields visible above fold (1366x768) | Passes external compliance review |
| F-M3-03 | MUST | Buyers enquire without account | Form accepts email + message |
| F-M3-04 | MUST | Automated qualification email within 5 minutes | P95 < 5 minutes |
| F-M3-05 | MUST | Lead Quality Score (0-100) per enquiry | Documented, reproducible formula |
| F-M3-06 | MUST | Ranked lead list sorted by score | Default: score desc, then recency |
| F-M3-07 | MUST | Viewing scheduling against seller's slots | .ics invites for both parties |
| F-M3-08 | SHOULD | Parse portal-forwarded enquiry emails into leads | IS24/Immowelt >=95% field extraction |

**AI Capability B — Buyer Qualification**

Generates outbound qualification emails to buyers and parses inbound replies into a structured `(budget, financingState, timing)` tuple.

**Constraints:**
- Outbound emails MUST sound human and **MUST NOT** start with `"Sehr geehrte/r Interessent/in"`.
- Inbound parsing MUST default each field to `UNKNOWN` if classifier confidence < 0.7.
- Free-text reply containing an explicit decline (`"kein Interesse"`, `"abgesagt"`, equivalents) MUST set lead status to `DECLINED` automatically.

### M4 — Offer Dashboard

**Goal:** Clear view of which offer to accept and why, safe handoff to notary.

**Offer Scoring (deterministic, no LLM):**
```
scoreAmount    = clamp01((amount - asking * 0.85) / (asking * 0.20)) * 100
scoreFinance   = { CASH: 100, PRE_APPROVED: 85, IN_PROCESS: 55, NONE: 15, UNKNOWN: 30 }
scoreTiming    = clamp01(1 - daysBetween(desiredClosing, now) / 180) * 100
scoreRisk      = 100 - (idVerified ? 0 : 25) - (financingProof ? 0 : 25)
                 - (amount < asking * 0.80 ? 25 : 0) - (profileAge < 1d ? 10 : 0)
scoreComposite = round(0.30 * amount + 0.30 * finance + 0.20 * timing + 0.20 * risk)
```

| ID | Pri | Requirement | Acceptance Criterion |
|---|---|---|---|
| F-M4-01 | MUST | Structured offer: amount, ID upload, financing proof | All three artefacts persisted |
| F-M4-02 | MUST | Buyer identity verification via uploaded ID | MVP: human review within 24h |
| F-M4-03 | MUST | Score offers on amount, financing, timeline, risk | All four sub-scores + composite visible |
| F-M4-04 | MUST | Compare 2-3 offers side-by-side | All scores, amounts, timelines rendered |
| F-M4-05 | MUST | Generate Reservierungsvereinbarung PDF on accept | PDF with buyer/seller/property details |
| F-M4-06 | MUST | Notary document checklist | Grundbuchauszug, Flurkarte, Teilungserklaerung, etc. |
| F-M4-07 | SHOULD | Propose suitable notaries by Bundesland | Top 5 with contact details |

### M5 — Expose Agent (Conversational)

**Goal:** Produce a complete, publication-ready Expose through conversational dialog — not a form. The agent asks targeted questions, requests missing info, drafts iteratively, self-reviews, and only completes when a quality bar is met.

**Behavioural model:**
- Stateful, multi-turn conversational agent (not a chatbot)
- Fixed goal: produce a complete, GEG-compliant Expose + price band
- Maintains structured working memory (known/missing/confirmed)
- Asks **one question at a time** in natural German
- Accepts photo uploads and Energieausweis inline (no redirects)
- Self-reviews against quality rubric, re-drafts on failure
- Hands off with "Review & Publish" payload

**Quality Rubric (self-review before completion):**
1. Mandatory GEG fields present and consistent with Energieausweis
2. Long description 250-600 words, three paragraphs (property, surroundings, opportunity)
3. No claims not traceable to seller input (zero hallucination)
4. No marketing superlatives breaching Wettbewerbsrecht
5. At least 6 photos, at least one exterior/floor plan
6. Asking price within recommended band (or seller explicit override)

**Agent Loop:**
```
while (run.status == RUNNING && run.turns < MAX_TURNS) {
  state = loadConversationState(conversation)
  prompt = buildPrompt({ systemRules, workingMemory, missingFields, history, tools })
  decision = llm.complete(prompt)
  switch (decision.type) {
    case TOOL_CALL:   executeTool -> persistStep -> continue
    case USER_TURN:   streamToUser -> persistTurn -> break (wait for reply)
    case COMPLETE:    qualityRubric.passes ? handoff : re-draft
  }
}
```

**Tool Surface:**

| Tool | Purpose |
|---|---|
| `address.validate` | Resolve and geocode property address |
| `energy.extract` | Extract fields from Energieausweis PDF |
| `pricing.recommend` | Run pricing engine, return band + comparables |
| `photo.analyse` | Classify photos by room type, detect quality issues |
| `listing.draft` | Generate long description + short summary |
| `listing.review` | Run quality rubric, return pass/fail per criterion |
| `handoff.commit` | Finalise: persist Property + Listing (REVIEW status) |

**Hard Constraints:**
- MAX_TURNS = 60 (exceeded = human review)
- MAX_COST_CENTS_PER_RUN = 200 (EUR 2, exceeded = abort with graceful message)
- Agent MUST NOT call tools outside TOOL_REGISTRY
- Agent MUST NOT execute SQL, write files, or call external URLs directly
- Every step persisted before next iteration (crash recovery resumes from last step)

**Dialog Phases:**

| # | Phase | Agent Action |
|---|---|---|
| 1 | Greet & frame | Greets in German, explains process, asks property type + location |
| 2 | Collect basics | One-at-a-time questions: type, address, area, rooms, year, condition |
| 3 | Collect documents | Requests photos (with guidance), Energieausweis upload or manual entry |
| 4 | Draft & self-review | Generates draft, runs rubric, re-drafts if needed, triggers pricing |
| 5 | Confirm & hand off | Presents complete Expose, highlights assumptions, hands to publish flow |

| ID | Pri | Requirement | Acceptance Criterion |
|---|---|---|---|
| F-M5-01 | MUST | German dialog, respond within 5s/turn (excl. LLM) | P95 < 5s mocked, < 12s live |
| F-M5-02 | MUST | Persist state after every turn, resume on reconnect | Browser close + reopen within 24h resumes |
| F-M5-03 | MUST | One user-facing question per turn | 50-conversation audit: zero multi-question turns |
| F-M5-04 | MUST | No hallucinated property attributes | 50-Expose audit: zero unverifiable claims |
| F-M5-05 | MUST | Self-review every draft against quality rubric | Audit trail shows rubric pass/fail; no completion without all-pass |
| F-M5-06 | MUST | Photo uploads inline in conversation | Drag-and-drop on desktop and mobile |
| F-M5-07 | MUST | Extract Energieausweis from PDF | >=95% accuracy on 30-PDF gold set |
| F-M5-08 | MUST | Hand off fully populated Property + Listing draft | Listing in REVIEW status with all M1 fields |
| F-M5-09 | SHOULD | Generate designed Expose PDF | Downloadable with branded layout |
| F-M5-10 | SHOULD | Allow seller to skip back and revise earlier answers | Revision propagates downstream |
| F-M5-11 | MUST | Log every tool call as AgentStep | Complete audit log per conversation |
| F-M5-12 | MUST | Seller can abandon agent and switch to M1 form | Collected fields persist to property record |

### M6 — Listing Agent (IS24 Syndication)

**Goal:** Publish, update and sync listings on ImmobilienScout24 without manual copy-pasting. Bring engagement signals back into Direkta.

**MVP Scope:**
- Primary target: ImmobilienScout24 only
- Operations: publish, update, pause/unpause, withdraw
- Inbound: pull daily views, contacts, bookmarks; ingest parsed enquiries as Leads
- Out of scope: Immowelt, Kleinanzeigen, regional portals

**Integration approach:** Headless-browser automation against IS24 with seller's own credentials. This is a **tactical MVP choice** with explicit migration path. Architecture uses a portal-agnostic `PortalDriver` interface so transport can be replaced by IS24 API or OpenImmo XML within two weeks.

**PortalDriver Interface:**
```typescript
interface PortalDriver {
  readonly portal: Portal;
  publish(input: PublishInput, ctx: AuthCtx):  Promise<PublishResult>;
  update(input: UpdateInput,  ctx: AuthCtx):   Promise<void>;
  pause(externalId: string,   ctx: AuthCtx):   Promise<void>;
  withdraw(externalId: string, ctx: AuthCtx):  Promise<void>;
  fetchStats(externalId: string, ctx: AuthCtx): Promise<PortalStatSnapshot>;
  fetchLeads(externalId: string, since: Date, ctx: AuthCtx): Promise<PortalLead[]>;
}
```

**Implementations:** `IS24BrowserDriver` (MVP), `IS24ApiDriver` (future), `OpenImmoFeedDriver` (future)

| ID | Pri | Requirement | Acceptance Criterion |
|---|---|---|---|
| F-M6-01 | MUST | Publish to IS24 within 30 min of trigger | P95 <= 30 min on 10-listing batch |
| F-M6-02 | MUST | Encrypt IS24 credentials (envelope encryption) | Pen-test: not retrievable in plaintext |
| F-M6-03 | MUST | Time-stamped consent dialog before storing credentials | Revocable from settings |
| F-M6-04 | MUST | Handle Captcha/MFA/layout-change gracefully | Seller notified within 1 hour |
| F-M6-05 | MUST | Update IS24 listing within 2 hours of Direkta edit | End-to-end test passes |
| F-M6-06 | MUST | Withdraw IS24 listing within 1 hour of pause/withdraw/reserved | All three transitions tested |
| F-M6-07 | MUST | Pull daily engagement stats as PortalStat | One snapshot per listing per day; gaps alert |
| F-M6-08 | MUST | Ingest IS24 enquiries as Lead records | Test enquiry appears within 30 min |
| F-M6-09 | MUST | Deduplicate leads by normalised email | Same buyer on Direkta + IS24 = one Lead |
| F-M6-10 | MUST | Portal-agnostic PortalDriver abstraction | Code review confirms abstraction |
| F-M6-11 | MUST | Rate-limit per IS24 account (default <= 1 action/8s) | Load tests pass under cap |
| F-M6-12 | MUST | Circuit breaker at >=25% failure rate over 30 min | Synthetic burst trips breaker |
| F-M6-13 | SHOULD | Per-listing portal dashboard (status, sync time, stats) | Renders all data |
| F-M6-14 | MUST | Re-consent required every 90 days | Syndication pauses on expiry |

**IS24 Browser-Automation Risks (Binding — Founders, Engineering, Product MUST acknowledge before M6 enters production)**

**Legal posture:**
- **ImmobilienScout24 General Terms of Use prohibit automated access** to the portal. Operating browser automation against IS24 with seller credentials is in breach of those terms even though the credentials are the seller's own.
- **Precedents under § 4 UWG (unfair competition)** exist where IS24 has obtained injunctions against tools that automate listing operations on behalf of users. Direkta must accept this as a real, not theoretical, exposure.
- If a seller's IS24 account is suspended due to detected automation, **Direkta is responsible** for restoring the seller's listing on alternative channels and absorbing the disruption.

**Operational risks:**
- **Bot-detection:** IS24 deploys active anti-automation (Cloudflare, behavioural fingerprinting). Detection rates vary; expect periodic full breakage requiring driver updates within 24 hours.
- **UI change:** any IS24 layout change can break the driver. SLOs assume up to 1 hour of outage per change, with auto-rollback to manual mode.
- **Captcha and MFA:** cannot be solved automatically by Direkta. The system MUST hand control back to the seller via a one-click re-auth flow that hands over a controlled browser session.

**Mitigations baked into the architecture:**
- `PortalDriver` abstraction: `IS24BrowserDriver` is replaceable by `IS24ApiDriver` or `OpenImmoFeedDriver` without product code changes.
- Per-credential isolation: separate browser contexts; no shared session state across sellers.
- Conservative pacing: default 1 action per 8 seconds, jittered.
- Explicit, time-stamped seller consent. The seller must understand they are authorising Direkta to act on their behalf and that automated access may breach IS24 terms.
- Circuit breaker: ≥ 25% failure rate over 30 minutes pauses all syndication for the affected portal across all sellers, until a human resumes.
- Migration plan: by **month 6 of operation**, Direkta MUST be on either an IS24 contractual relationship (API or OpenImmo) or migrating off IS24 as a primary distribution channel.

**Founder-level decisions required before launch:**
1. Sign-off from legal counsel that the consent-gated, seller-credential model is the position Direkta is willing to defend.
2. Decision on whether to disclose the automation approach in seller-facing copy (**recommended: yes**).
3. Budget and timeline for IS24 commercial conversation in parallel to MVP launch.

---

## 7. Cross-Cutting Requirements

| ID | Pri | Requirement | Acceptance Criterion |
|---|---|---|---|
| F-AUTH-01 | MUST | Account creation via email+password or magic link | Sign up + login within 60 seconds |
| F-AUTH-02 | MUST | Email verification before account features | Unverified users cannot publish |
| F-AUTH-03 | MUST | Password reset via email | Reset link valid 30 min, single-use |
| F-AUTH-04 | SHOULD | Social login (Google, Apple) | End-to-end sign-in works |
| F-AUTH-05 | MUST | Sessions expire after 30 days inactivity | Server-side invalidation |
| F-AUTH-06 | MUST | Account deletion with full erasure within 30 days | 14-day grace period, then irreversible |
| F-X-01 | MUST | All seller UI in German | 100% of strings translated |
| F-X-02 | MUST | Branded, GDPR-compliant emails with unsubscribe | 20-point email QA checklist |
| F-X-03 | MUST | Immutable event log per listing | Every state transition logged |
| F-X-04 | MUST | GDPR data export (Art. 20) | JSON + PDF from account settings |
| F-X-05 | SHOULD | Human-support escalation in 2 clicks | Support button on all authenticated screens |

---

## 8. User Flows

### 8.1 Seller Flow — Happy Path

| # | Stage | What Happens |
|---|---|---|
| 1 | Land | Arrives via SEO/ads/referral. Single CTA: "Find out what your property is worth." |
| 2 | Estimate | Enter address + 5 fields. Instant indicative price band. No account needed. |
| 3 | Account | Create account (email+password or magic link) to get full report. |
| 4 | Onboard | Complete property record, upload photos, upload/enter Energieausweis. |
| 5 | Review & Publish | Review AI listing, edit any field, publish. Compliance check gate. |
| 6 | Distribute | Live on Direkta landing page; optional one-click IS24 syndication. |
| 7 | Operate | Leads auto-qualified, ranked inbox, schedule viewings, receive offers. |
| 8 | Close | Pick offer in dashboard, accept, download Reservierungsvereinbarung, notary handoff. |

### 8.2 Buyer Flow — Happy Path

| # | Stage | What Happens |
|---|---|---|
| 1 | Discover | Find listing on portal or direct link. |
| 2 | View | Browse photos, read description, download Energieausweis PDF. |
| 3 | Enquire | Fill enquiry form. No account required. |
| 4 | Qualify | Within 5 min: automated email with 3 structured questions. |
| 5 | Schedule | If qualified: offered viewing slots, books one, gets calendar invite. |
| 6 | View | Attends viewing. After: receives "Submit offer" form. |
| 7 | Offer | Enter amount, upload financing proof + ID, submit. |
| 8 | Outcome | Accept/decline/counter notification. If accepted: notary workflow. |

### 8.3 IS24 Listing Agent — Operational Flow

| # | Stage | What Happens |
|---|---|---|
| 1 | Connect | Seller adds IS24 credentials in account settings. Direkta verifies login in a sandboxed run. Credentials encrypted at rest (envelope encryption, per-tenant key). |
| 2 | Schedule | When the Direkta listing is published, a `SyndicationJob` is enqueued for IS24. |
| 3 | Push | Worker logs in, fills the IS24 listing form using property + media data, publishes, and stores the resulting IS24 listing ID. |
| 4 | Sync (daily) | Worker logs in, scrapes the seller's IS24 dashboard for stats and inbound contacts, persists deltas as `PortalStat` and `Lead` records. |
| 5 | Update | When seller edits the listing in Direkta, an update job is enqueued and the IS24 listing is patched. |
| 6 | Withdraw | When the listing is paused or closed in Direkta, the IS24 listing is paused or removed accordingly. |

### 8.4 Edge Flows (Must Work)

- Seller pauses listing and resumes later (leads retained, viewings rescheduled)
- Seller withdraws listing (active buyers notified)
- Buyer withdraws offer before acceptance
- Two offers for same amount within minutes (tie-break by financing strength)
- Buyer requests viewing outside defined slots (manual approval queue)
- GDPR deletion request from buyer
- Expose Agent dialog interrupted (resume from last confirmed state)
- IS24 syndication fails mid-flow (listing stays live on Direkta, retry queued, seller notified within 1h)
- Lead arrives via IS24 for email already in pipeline (deduplicate)

---

## 9. Technical Architecture

### 9.1 Architecture Layers

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) + TypeScript — SSR for public pages, CSR for auth app |
| Backend | NestJS (TypeScript) — REST API + webhooks |
| Database | **PostgreSQL 15** — transactional data, JSONB for flexible attributes |
| ORM | **Prisma** — type-safe, first-class migrations |
| Object Storage | **Cloudflare R2** or **AWS S3** (eu-central-1) — photos, PDFs |
| Queue | **BullMQ on Redis** — image processing, AI calls, email, scheduled jobs |
| Auth | **Auth.js (NextAuth)** or **Clerk** — email + magic link + social |
| AI/LLM | **Anthropic Claude** or **OpenAI GPT-4-class** — EU data residency |
| Image Enhancement | Replicate or AWS Rekognition + OpenCV |
| Email | **Postmark** — transactional + inbound parsing |
| Hosting (frontend) | **Vercel** |
| Hosting (backend) | **Hetzner Cloud + Coolify** or **Fly.io** — EU data residency |
| Observability | **Sentry** + **Better Stack** |
| Analytics | **PostHog** (EU self-hosted) — analytics + feature flags + session replay |

### 9.2 System Diagram

```
[ Buyer Browser ]                  [ Seller Browser ]
        |                                   |
        v                                   v
+---------------------------------------------------+
|             Next.js (Vercel) — SSR/CSR            |
|   Public landing pages    |   Authenticated app   |
+--------------------+------+-----------+-----------+
                     |                  |
                     v                  v
              +----------------------------+
              |   API Gateway (NestJS)     |
              +----------------------------+
                |        |        |        |
                v        v        v        v
         [Postgres] [Redis/Q] [S3/R2]  [Auth]
                          |
                          v
                 +-------------------+
                 |  Worker pool      |
                 |  - LLM calls      |
                 |  - Image enhance  |
                 |  - Email dispatch  |
                 |  - Scoring        |
                 +-------------------+
                          |
                          v
              [LLM API] [Image API] [Email API]
              [Address API] [Comparables sources]
```

### 9.3 Repository Layout

```
direkta/
  apps/
    web/                # Next.js app
    api/                # NestJS app
    workers/            # BullMQ workers
  packages/
    shared/             # types, zod schemas, constants
    ui/                 # shared UI components
    domain/             # pure domain logic (pricing, scoring)
  infra/
    docker/
    terraform/          # post-MVP
  .github/
    workflows/
```

### 9.4 Environments

| Environment | Purpose | Notes |
|---|---|---|
| local | Engineering laptops | Docker Compose: Postgres, Redis, Mailhog. LLM calls to real provider. |
| preview | Per-PR ephemeral | Vercel preview + temporary Postgres branch. |
| staging | Pre-prod | Same schema, anonymised seed data. QA and demo. |
| production | Live | EU region. Daily backups. Read replica post-MVP. |

---

## 10. Data Model

**12 core entities + 6 agent/syndication entities.** Engineering may add helper tables but these are binding.

### Core Entities

| Entity | Purpose |
|---|---|
| `User` | Account holder (seller, admin, support) |
| `Property` | Real-world property. Unique by address. |
| `Listing` | A sales attempt for a Property. One active at a time. |
| `EnergyCertificate` | Energieausweis data + PDF reference |
| `MediaAsset` | Photo, floor plan, document |
| `PriceRecommendation` | Pricing engine output: bands, strategies, comparables, confidence |
| `Comparable` | Anonymised comparable transaction for pricing |
| `Lead` | Buyer enquiry tied to a Listing |
| `BuyerProfile` | Buyer who progressed past qualification |
| `Viewing` | Scheduled viewing slot |
| `Offer` | Formal offer on a Listing |
| `Transaction` | Successful offer progressed to notary (terminal state) |

### Agent & Syndication Entities

| Entity | Purpose |
|---|---|
| `Conversation` | Turn-by-turn Expose Agent dialog |
| `ConversationTurn` | Single turn with role, content, tool I/O, tokens, latency |
| `AgentRun` | Single goal-driven agent execution with audit trail |
| `AgentStep` | Individual tool call within a run |
| `PortalCredential` | Encrypted portal credentials with consent metadata |
| `SyndicationTarget` | Listing x Portal mapping with external ID |
| `SyndicationJob` | Queued/executed portal operation |
| `PortalStat` | Daily engagement snapshot per listing per portal |

### Key Enums

```
ListingStatus:    DRAFT | REVIEW | ACTIVE | PAUSED | RESERVED | CLOSED | WITHDRAWN
PropertyType:     ETW | EFH | MFH | DHH | RH | GRUNDSTUECK
FinancingState:   CASH | PRE_APPROVED | IN_PROCESS | NONE | UNKNOWN
LeadStatus:       NEW | QUALIFYING | QUALIFIED | VIEWING_SCHEDULED | OFFER_MADE | DECLINED
OfferStatus:      SUBMITTED | UNDER_REVIEW | ACCEPTED | REJECTED | WITHDRAWN | COUNTERED
AgentRunStatus:   RUNNING | SUCCEEDED | FAILED | CANCELLED
SyndicationStatus: NONE | QUEUED | LIVE | PAUSED | FAILED | WITHDRAWN
JobStatus:        QUEUED | RUNNING | SUCCESS | FAILED | RETRYING | DEAD
```

### Full Prisma Schema

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  emailVerifiedAt DateTime?
  passwordHash    String?
  name            String?
  phone           String?
  role            UserRole  @default(SELLER)
  createdAt       DateTime  @default(now())
  deletedAt       DateTime?
  listings        Listing[]
}

enum UserRole { SELLER ADMIN SUPPORT }

model Property {
  id           String              @id @default(cuid())
  ownerUserId  String
  type         PropertyType
  street       String
  houseNumber  String
  postcode     String
  city         String
  country      String              @default("DE")
  lat          Float
  lng          Float
  livingArea   Float                // m^2
  plotArea     Float?
  yearBuilt    Int?
  rooms        Float?
  bathrooms    Int?
  floor        Int?
  condition    PropertyCondition
  attributes   Json                 // freeform: balcony, garage, fireplace, ...
  energyCert   EnergyCertificate?
  listings     Listing[]
  media        MediaAsset[]
  createdAt    DateTime             @default(now())
}

enum PropertyType { ETW EFH MFH DHH RH GRUNDSTUECK }
enum PropertyCondition { ERSTBEZUG GEPFLEGT RENOVIERUNGS_BEDUERFTIG SANIERUNGS_BEDUERFTIG NEUBAU ROHBAU }

model Listing {
  id              String         @id @default(cuid())
  propertyId      String
  status          ListingStatus
  publishedAt     DateTime?
  pausedAt        DateTime?
  closedAt        DateTime?
  slug            String         @unique
  titleShort      String          // 160 chars max
  descriptionLong String          // generated, editable
  askingPrice     Decimal
  priceRecId      String?
  leads           Lead[]
  offers          Offer[]
  viewings        Viewing[]
  events          ListingEvent[]
  createdAt       DateTime       @default(now())
}

enum ListingStatus { DRAFT REVIEW ACTIVE PAUSED RESERVED CLOSED WITHDRAWN }

model EnergyCertificate {
  id             String         @id @default(cuid())
  propertyId     String         @unique
  type           EnergyCertType
  validUntil     DateTime
  energyClass    String          // A+, A, B, ... H
  energyValue    Float           // kWh / (m^2 * a)
  primarySource  String          // gas, oil, district heating, electricity, ...
  pdfAssetId     String?
}

enum EnergyCertType { VERBRAUCH BEDARF }

model MediaAsset {
  id          String    @id @default(cuid())
  propertyId  String?
  listingId   String?
  kind        MediaKind
  storageKey  String     // S3 key
  mimeType    String
  width       Int?
  height      Int?
  enhanced    Boolean   @default(false)
  ordering    Int       @default(0)
  createdAt   DateTime  @default(now())
}

enum MediaKind { PHOTO FLOORPLAN DOCUMENT ENERGY_PDF ID_PROOF FINANCING_PROOF }

model PriceRecommendation {
  id            String          @id @default(cuid())
  listingId     String          @unique
  low           Decimal
  median        Decimal
  high          Decimal
  strategyQuick Decimal
  strategyReal  Decimal
  strategyMax   Decimal
  confidence    PriceConfidence
  comparables   Comparable[]
  createdAt     DateTime        @default(now())
}

enum PriceConfidence { LOW MEDIUM HIGH }

model Comparable {
  id              String       @id @default(cuid())
  priceRecId      String
  source          String        // 'is24' | 'immowelt' | 'kleinanzeigen' | 'transaction_db'
  externalId      String?
  type            PropertyType
  livingArea      Float
  pricePerSqm     Float
  distanceMeters  Int
  ageDays         Int
  similarityScore Float         // 0..1
}

model Lead {
  id             String           @id @default(cuid())
  listingId      String
  emailRaw       String
  name           String?
  phone          String?
  message        String?
  budget         Decimal?
  financingState FinancingState?
  timing         BuyerTiming?
  qualityScore   Int?              // 0..100
  status         LeadStatus
  createdAt      DateTime         @default(now())
}

enum FinancingState { CASH PRE_APPROVED IN_PROCESS NONE UNKNOWN }
enum BuyerTiming { IMMEDIATELY WITHIN_3M WITHIN_6M LATER UNKNOWN }
enum LeadStatus { NEW QUALIFYING QUALIFIED VIEWING_SCHEDULED OFFER_MADE DECLINED }

model BuyerProfile {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  phone         String?
  idVerifiedAt  DateTime?
  idAssetId     String?
  offers        Offer[]
}

model Viewing {
  id         String         @id @default(cuid())
  listingId  String
  leadId     String?
  buyerId    String?
  startsAt   DateTime
  endsAt     DateTime
  mode       ViewingMode
  status     ViewingStatus
  notes      String?
}

enum ViewingMode { ONSITE VIRTUAL }
enum ViewingStatus { PROPOSED CONFIRMED COMPLETED CANCELLED NO_SHOW }

model Offer {
  id               String      @id @default(cuid())
  listingId        String
  buyerId          String
  amount           Decimal
  financingProofId String?
  conditions       String?
  desiredClosingAt DateTime?
  scoreAmount      Int?
  scoreFinance     Int?
  scoreTiming      Int?
  scoreRisk        Int?
  scoreComposite   Int?
  status           OfferStatus
  createdAt        DateTime    @default(now())
}

enum OfferStatus { SUBMITTED UNDER_REVIEW ACCEPTED REJECTED WITHDRAWN COUNTERED }

model Transaction {
  id                    String    @id @default(cuid())
  listingId             String    @unique
  acceptedOfferId       String    @unique
  notaryName            String?
  notaryAddress         String?
  reservationPdfAssetId String?
  closedAt              DateTime?
  finalPrice            Decimal?
}

model ListingEvent {
  id          String   @id @default(cuid())
  listingId   String
  type        String    // free-form, e.g. 'PUBLISHED', 'LEAD_RECEIVED', 'OFFER_ACCEPTED'
  payload     Json
  actorUserId String?
  createdAt   DateTime @default(now())
}

// ----- Agentic & Syndication models -----

model Conversation {
  id         String             @id @default(cuid())
  userId     String
  listingId  String?
  agentKind  AgentKind
  status     ConversationStatus
  turns      ConversationTurn[]
  startedAt  DateTime           @default(now())
  closedAt   DateTime?
}

enum AgentKind { EXPOSE LISTING }
enum ConversationStatus { ACTIVE PAUSED COMPLETED ABANDONED }

model ConversationTurn {
  id              String   @id @default(cuid())
  conversationId  String
  role            TurnRole
  content         String    // user message, agent message, or serialized tool I/O
  toolName        String?   // present when role == TOOL
  toolInput       Json?
  toolOutput      Json?
  tokensIn        Int?
  tokensOut       Int?
  latencyMs       Int?
  createdAt       DateTime @default(now())
}

enum TurnRole { USER AGENT TOOL SYSTEM }

model AgentRun {
  id             String         @id @default(cuid())
  agentKind      AgentKind
  conversationId String?         // null for non-conversational agents (Listing Agent)
  listingId      String?
  goal           String          // human-readable, e.g. 'Publish to IS24'
  status         AgentRunStatus
  steps          AgentStep[]
  costCents      Int?            // total LLM cost
  startedAt      DateTime       @default(now())
  finishedAt     DateTime?
  error          String?
}

enum AgentRunStatus { RUNNING SUCCEEDED FAILED CANCELLED }

model AgentStep {
  id         String   @id @default(cuid())
  agentRunId String
  ordinal    Int
  toolName   String    // e.g. 'address.validate', 'pricing.recommend', 'is24.publish'
  input      Json
  output     Json?
  latencyMs  Int?
  ok         Boolean
  error      String?
  createdAt  DateTime @default(now())
}

model PortalCredential {
  id             String           @id @default(cuid())
  userId         String
  portal         Portal
  username       String
  passwordCipher Bytes             // envelope-encrypted
  consentedAt    DateTime
  reconfirmedAt  DateTime?
  status         CredentialStatus
  lastVerifiedAt DateTime?
}

enum Portal { IMMOSCOUT24 IMMOWELT KLEINANZEIGEN }
enum CredentialStatus { ACTIVE INVALID REVOKED EXPIRED }

model SyndicationTarget {
  id                String            @id @default(cuid())
  listingId         String
  portal            Portal
  externalListingId String?            // populated after first publish
  externalUrl       String?
  status            SyndicationStatus
  lastSyncedAt      DateTime?
  jobs              SyndicationJob[]
  stats             PortalStat[]
  @@unique([listingId, portal])
}

enum SyndicationStatus { NONE QUEUED LIVE PAUSED FAILED WITHDRAWN }

model SyndicationJob {
  id                  String             @id @default(cuid())
  syndicationTargetId String
  kind                SyndicationJobKind
  status              JobStatus
  attempts            Int                @default(0)
  lastError           String?
  agentRunId          String?
  scheduledFor        DateTime           @default(now())
  startedAt           DateTime?
  finishedAt          DateTime?
}

enum SyndicationJobKind { PUBLISH UPDATE PAUSE UNPAUSE WITHDRAW SYNC_STATS SYNC_LEADS }
enum JobStatus { QUEUED RUNNING SUCCESS FAILED RETRYING DEAD }

model PortalStat {
  id                  String   @id @default(cuid())
  syndicationTargetId String
  date                DateTime  // day granularity
  impressions         Int      @default(0)
  detailViews         Int      @default(0)
  contactRequests     Int      @default(0)
  bookmarks           Int      @default(0)
  @@unique([syndicationTargetId, date])
}
```

---

## 11. API Surface

Single REST API at `api.direkta.de/v1`. JSON, Bearer JWT auth, kebab-case paths, camelCase fields.

### Conventions
- Versioning via URL prefix `/v1`
- Errors: RFC 7807 (`application/problem+json`)
- Pagination: `?page`, `?perPage` (max 100)
- Filtering: `?filter[field]=value`
- Sorting: `?sort=field,-otherField`
- Idempotency: `Idempotency-Key` header (UUIDv4) on writes
- Rate limiting: 60 req/min per user, 600/hour

### Endpoint Catalogue

**Auth:**
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup` | Create seller account |
| POST | `/auth/login` | Email+password login, returns JWT |
| POST | `/auth/magic-link` | Passwordless login link |
| POST | `/auth/logout` | Invalidate session |
| GET | `/me` | Current user |
| DELETE | `/me` | GDPR account deletion |

**Properties & Listings:**
| Method | Path | Purpose |
|---|---|---|
| POST | `/properties` | Create property record |
| GET | `/properties/:id` | Get property |
| PATCH | `/properties/:id` | Update property |
| POST | `/properties/:id/media` | Upload photo/document (presigned URL) |
| POST | `/properties/:id/energy-certificate` | Attach Energieausweis |
| POST | `/listings` | Create draft listing |
| GET | `/listings/:id` | Get listing |
| PATCH | `/listings/:id` | Edit listing fields |
| POST | `/listings/:id/generate` | Trigger AI generation |
| POST | `/listings/:id/price-recommendation` | Compute pricing |
| POST | `/listings/:id/publish` | Compliance check + publish |
| POST | `/listings/:id/pause` | Pause listing |
| POST | `/listings/:id/withdraw` | Withdraw listing |

**Leads & Viewings:**
| Method | Path | Purpose |
|---|---|---|
| GET | `/listings/:id/leads` | List leads for listing |
| POST | `/public/listings/:slug/enquire` | Public buyer enquiry (rate-limited, captcha) |
| POST | `/leads/:id/qualify-response` | Buyer qualification answers webhook |
| POST | `/leads/:id/decline` | Seller declines lead |
| POST | `/listings/:id/viewings` | Create viewing slot |
| POST | `/viewings/:id/book` | Book slot for lead |

**Offers & Transactions:**
| Method | Path | Purpose |
|---|---|---|
| GET | `/listings/:id/offers` | List offers |
| POST | `/public/listings/:slug/offers` | Public buyer offer |
| POST | `/offers/:id/score` | Recompute scoring |
| POST | `/offers/:id/accept` | Accept offer, create Transaction |
| POST | `/offers/:id/reject` | Reject offer |
| GET | `/transactions/:id/notary-package` | Download notary document package |

**Expose Agent:**
| Method | Path | Purpose |
|---|---|---|
| POST | `/agents/expose/conversations` | Start new conversation |
| GET | `/agents/expose/conversations/:id` | Resume (full turn history) |
| POST | `/agents/expose/conversations/:id/turns` | Send turn, SSE-stream reply |
| POST | `/agents/expose/conversations/:id/handoff` | Finalise to Property + Listing |

**Portal Syndication:**
| Method | Path | Purpose |
|---|---|---|
| GET | `/portals/credentials` | List connected portals |
| POST | `/portals/credentials` | Add/replace portal credentials |
| DELETE | `/portals/credentials/:id` | Revoke + pause syndication |
| POST | `/listings/:id/syndication` | Enqueue publish job |
| GET | `/listings/:id/syndication` | Syndication statuses + stats |
| POST | `/listings/:id/syndication/:portal/pause` | Pause on portal |
| POST | `/listings/:id/syndication/:portal/withdraw` | Withdraw from portal |
| POST | `/listings/:id/syndication/:portal/resync` | Force re-sync |

**Webhooks:**
| Method | Path | Purpose |
|---|---|---|
| POST | `/webhooks/email-inbound` | Postmark inbound mail parsing |
| POST | `/webhooks/portal-enquiry` | Portal enquiry forwarding |

### Example: Create Listing

```http
POST /v1/listings
Authorization: Bearer <jwt>
Idempotency-Key: 9f3a4d12-7b6c-4e8f-9a2c-1b8d3e4f5a6b
Content-Type: application/json

{
  "propertyId": "prop_clz...",
  "askingPrice": 489000,
  "titleShort": "Helle 3-Zimmer-Wohnung mit Balkon in Prenzlauer Berg",
  "descriptionLong": null   // null => trigger generation
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "lst_clz...",
  "status": "DRAFT",
  "slug": "berlin/3-zimmer-prenzlauer-berg-9f3a",
  "askingPrice": "489000.00",
  "createdAt": "2026-04-26T10:14:23Z"
}
```

### Example: Error Response (RFC 7807)

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://docs.direkta.de/errors/compliance-failed",
  "title": "Compliance check failed",
  "status": 422,
  "detail": "Energy certificate is missing required fields.",
  "instance": "/v1/listings/lst_clz.../publish",
  "violations": [
    { "field": "energyCert.energyClass", "rule": "required" },
    { "field": "energyCert.validUntil", "rule": "future-date" }
  ]
}
```

### Example: Expose Agent Turn (SSE-Streamed)

```http
POST /v1/agents/expose/conversations/conv_clz.../turns
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "role": "USER",
  "content": "Es ist eine 3-Zimmer-Wohnung im 2. OG, ca. 78 m²."
}
```

```
HTTP/1.1 200 OK
Content-Type: text/event-stream

event: turn.started
data: {"turnId":"trn_clz...","role":"AGENT"}

event: token
data: {"text":"Verstanden. "}

event: token
data: {"text":"Hat die Wohnung einen Balkon oder eine Terrasse?"}

event: tool.call
data: {"name":"address.validate","input":{"raw":"Schönhauser Allee 123, 10437 Berlin"}}

event: tool.result
data: {"name":"address.validate","ok":true,"output":{"lat":52.54,"lng":13.41}}

event: turn.completed
data: {"turnId":"trn_clz...","tokensIn":412,"tokensOut":63,"latencyMs":2840}
```

---

## 12. External Integrations

### Mandatory (MVP)

| Integration | Provider Options | Purpose |
|---|---|---|
| Address validation | Google Maps Platform OR OSM Nominatim | Validate address, geocode |
| LLM API | Anthropic OR OpenAI (EU residency) | Listing text, qualification, explanations |
| Image enhancement | Replicate OR Stability AI | Photo correction |
| Transactional email | Postmark OR Resend | Outbound + inbound parsing |
| Object storage | Cloudflare R2 OR AWS S3 (eu-central-1) | Photos and PDFs |
| Error monitoring | Sentry | Frontend + backend exceptions |
| Analytics | PostHog (EU cloud or self-hosted) | Funnels, feature flags, session replay |
| Payments | Stripe (cards + SEPA Lastschrift) | EU-routing |

### Comparables Data Sources (ranked by trust)

1. Direkta-internal closed transactions (initially zero, primary over time)
2. Public Bodenrichtwert and Gutachterausschuss data per Bundesland
3. Listing prices from public portals (triangulation signal only, never sole basis)

**Must not scrape sources whose ToS prohibit scraping.** Prefer official APIs or paid providers (Sprengnetter, PriceHubble).

### Optional / Post-MVP

- KYC: IDnow, PostIdent, Veriff (MVP uses manual review)
- E-signature: DocuSign, Yousign (MVP uses downloadable PDF)
- Financing: Europace, Hypoport API (MVP accepts PDF uploads)
- Notary directory: Bundesnotarkammer (MVP uses curated list of 50)

---

## 13. Non-Functional Requirements

### Performance

| Metric | Target |
|---|---|
| Public landing page TTFB | < 400ms (P95) |
| Public landing page LCP | < 2.0s (P95) on 4G |
| Authenticated dashboard load | < 1.5s (P95) |
| Listing text generation | < 30s (P95) |
| Image enhancement per photo | < 8s (P95), async with progress |
| Buyer qualification email | < 5 min from enquiry |
| API P95 latency (read) | < 200ms |
| API P95 latency (write) | < 500ms |

### Availability
- Production: **99.5%** monthly uptime (MVP), 99.9% post-MVP
- Public pages readable even if API down (cached SSR, 24h TTL)
- Maintenance: weekdays 03:00-05:00 CET

### Security
- All traffic TLS 1.2+, HSTS preload
- Passwords: Argon2id hashes
- File uploads scanned for malware (ClamAV)
- Photos/PDFs via presigned URLs (max 60 min TTL)
- Strict CSP, X-Frame-Options DENY
- Audit log: every Listing/Offer/Transaction state change with actor, IP, timestamp
- Secrets in cloud secret manager, rotated quarterly

### Data Residency & Privacy
- **All databases, storage, backups MUST reside in EU**
- LLM/image providers MUST offer EU residency or DPA-compliant config
- PII encrypted at rest (Postgres TDE or column-level)
- Backups encrypted, 30-day retention, restorable in < 4 hours

### Accessibility
- WCAG 2.1 AA for public and authenticated pages
- All interactive elements keyboard navigable with visible focus

### Internationalisation
- MVP: German (de-DE) only
- Architecture supports adding locales without code changes (i18n keys)

### Observability
- Every API request logged with request ID, user ID, listing ID
- Distributed tracing (Sentry Performance or OpenTelemetry)
- Business metrics dashboard: signups, listings, leads, offers, transactions, NPS — daily refresh

---

## 14. Compliance & Legal

### GDPR (DSGVO)
- Lawful basis: contract (sellers), legitimate interest (buyer initial contact), consent (marketing)
- Data subject rights: access (Art. 15), rectification (Art. 16), erasure (Art. 17), portability (Art. 20) — exercisable from account UI within 30 days
- DPAs signed with every sub-processor
- Verzeichnis von Verarbeitungstaetigkeiten maintained from day one

### GEG / Energieausweis
- Every public listing MUST display: type, validity, energy class, value, primary source, year built
- Listings without valid Energieausweis MUST NOT publish

### GwG (Anti-Money-Laundering)
- If Direkta triggers Makler classification, GwG duties apply — legal opinion required before launch
- Product verifies buyer identity at offer time as trust feature regardless

### Telemediengesetz / TTDSG
- Cookie banner with explicit consent, granular per category
- Impressum and Datenschutzerklaerung in every page footer

### Liability
- All AI text reviewable by seller before publication (seller is legal author)
- Price recommendations are recommendations, never guarantees
- Notary handoff explicitly transfers legal responsibility to notary

### Trust Architecture
- Transparent comparables behind every price recommendation
- Seller-visible audit log of all listing actions
- "Talk to a human" link, 2 clicks max, on every authenticated screen
- No dark patterns: no urgency timers, no fake activity, no buyer count inflation
- Reversible actions within 24h (except notary handoff)

---

## 15. Pricing & Business Model

### Model A — Flat Fee
- **EUR 999** one-time, charged on listing publication
- Refundable within 14 days if no buyer enquiries

### Model B — Success Fee
- **0.5% to 1.0%** of final sale price, charged on Transaction closure
- **Capped at EUR 4,900**
- Default for sellers above EUR 600,000 asking price

### Technical Implications
- Each Listing carries `pricingModel` field (FLAT_FEE | SUCCESS_FEE)
- Each Transaction computes and persists fee owed at closure
- Payment: **Stripe** (cards + SEPA Lastschrift), EU-routing
- Auto-generated PDF invoices stored against Transaction
- Flat-fee 14-day refunds via Stripe API; Listing flagged REFUNDED but not deleted
- **Success-fee disputes are handled by support, not by automated refund**

---

## 16. Go-to-Market Technical Requirements

### SEO
- SSR public pages with OpenGraph and `schema.org/RealEstateListing` structured data
- Programmatic pages per city: `/immobilien/{city}/wohnung-verkaufen`, etc.
- Auto-generated sitemap.xml including every published Listing
- Deleted listings 301 redirect to city page (never 404)

### Lead Magnet: Free Valuation
- Standalone `/was-ist-meine-immobilie-wert` flow, returns indicative price band without account
- Email gate for full report
- 14-day email drip sequence via Postmark

### Tracking & Attribution
- Server-side conversion events to Google Ads and Meta Ads
- UTM parameters captured at first touch, persisted to User + Listing
- Server-side GTM (stape.io or self-hosted); no third-party scripts without consent

### Sharing
- Public share URL per listing with server-generated OpenGraph image
- WhatsApp, Facebook, email deep links

---

## 17. Timeline & Milestones

**8-week MVP, 2-engineer baseline** (one full-stack, one platform/agent specialist).

| Week | Phase | Deliverable | Exit Criterion |
|---|---|---|---|
| 1 | Foundation | Repo, CI, scaffolds, auth, base data model, agent runtime skeleton | Sign up + login works in prod. Agent loop boots with mock tools. |
| 2 | Property + Listing | Property creation, photo upload, listing draft, seller dashboard. M1 form path. | Test property created end-to-end. |
| 3 | AI + Expose Agent v1 | Listing text gen. Expose Agent with 4 tools (validate, draft, review, handoff). | Generated text passes 5-listing review. Agent completes test conversation. |
| 4 | Pricing + Publish + Agent v2 | Pricing engine v1, compliance check, public landing page. Agent + energy.extract + pricing. | First listing published via both M1 and M5 paths on staging. |
| 5 | Lead Funnel | Enquiry form, qualification loop, lead score, inbox UI, viewing scheduling. | End-to-end lead intake from public page to scheduled viewing. |
| 6 | Offers + IS24 Push | Offer submission, scoring, comparison, accept flow, Reservierungsvereinbarung. M6 push. | Offer accepted; listing publishes to IS24 sandbox. |
| 7 | Sync + Compliance | M6 daily stats + lead ingestion. GDPR exports, Energieausweis flows, audit log, cookie banner. | External legal review passes incl. IS24 risk. |
| 8 | Launch | Beta with 10 hand-picked sellers, support, monitoring, on-call, circuit breakers. | 5 listings on Direkta + IS24, first qualified leads received. |

### Critical Path
- **Compliance check** (M1) — blocks week 4; no listing can publish without it
- **Pricing engine** (M2) — blocks beta success; sellers won't trust without numbers
- **Offer dashboard** (M4) — blocks hypothesis test of "replaces a Makler"
- **Expose Agent** (M5) — primary onboarding; if slips past week 4, fall back to M1-only
- **Listing Agent** (M6) — primary distribution; if IS24 driver unstable, ship with manual cross-posting

---

## 18. Success Metrics & KPIs

### MVP Acceptance — Engineering
All simultaneously true:
- 100% of MUST requirements pass acceptance tests
- All NFRs met or have documented, time-boxed exceptions
- E2E test suite covers seller + buyer flows, runs in CI on every PR
- External legal review signed off (GDPR, GEG, TTDSG)
- Production on EU infrastructure with backups and alerting

### MVP Acceptance — Product (across 25+ closed transactions)

| KPI | Target |
|---|---|
| Median time-to-sale | <= 90 days (listing to Transaction closure) |
| Net seller proceeds vs. Makler | >= 100% (after Direkta fee) |
| Seller NPS | >= 50 |
| Lead-to-offer conversion | >= 8% |
| Offer-to-acceptance conversion | >= 35% |
| Compliance violations | 0 |
| P95 LCP on public pages | < 2.0s |
| AI hallucination rate | < 1% |
| Expose Agent completion rate | >= 70% (conversations reaching handoff) |
| Expose Agent median time | <= 18 min (first turn to handoff) |
| Expose Agent cost per run | <= EUR 0.80 |
| IS24 syndication success rate | >= 95% |
| IS24 stats sync uptime | >= 99% / 30 days |
| IS24 lead ingestion latency | <= 30 min (P95) |
| Post-hoc human intervention rate | < 5% (sales requiring Direkta-staff intervention to complete) |

### Operational KPIs (Post-Launch)
- **Weekly:** signups, properties created, listings published, leads, offers, transactions
- **Monthly:** cohort retention, fee revenue, refund rate, support tickets per listing
- **Quarterly:** comparable accuracy (predicted vs. actual closing price)

---

## 19. Out of Scope (MVP)

Engineering MUST NOT build these. Product MUST NOT promise them.

| Feature | Why Deferred |
|---|---|
| Native mobile apps | Mobile web sufficient for low-frequency seller + initial buyer flows |
| 3D virtual tours / Matterport | High cost, marginal uplift, distracts from process value |
| Integrated mortgage brokerage | Regulatory complexity, partnership-driven |
| Notary e-signing of Kaufvertrag | Requires physical presence in DE for residential |
| AI-driven negotiation / auto-counter | Trust risk too high; decisions stay with seller |
| Multi-language UI | Single market, single language reduces test surface |
| Buyer accounts & saved searches | Buyers don't need accounts to convert |
| Property valuation as standalone product | Lead magnet only, not separately monetised |
| Open API for third parties | No proven demand; opens security surface |
| Service provider marketplace | Two-sided liquidity problem; revisit after 100 transactions |
| Auto-syndication to 12+ portals | IS24 only via M6; others deferred until driver proven |
| Insurance products | Regulatory and partnership burden |
| Mobile push notifications | Email + WhatsApp sufficient |
| A/B testing beyond PostHog | PostHog covers MVP needs |

---

## 20. Glossary

| Term | Definition |
|---|---|
| Agent | Goal-driven LLM-orchestrated component with bounded tools, working memory, and success criterion |
| AgentRun | One execution of an agent with specific goal and audit trail |
| Bestellerprinzip | German rule requiring agent-hiring party to pay; for sales, commission split buyer/seller |
| Bodenrichtwert | Statutory land reference value per municipality |
| Circuit breaker | Pattern suspending integration when failure rate exceeds threshold |
| DSGVO/GDPR | EU General Data Protection Regulation |
| Energieausweis | Mandatory German energy performance certificate |
| ETW/EFH/MFH/DHH/RH | Eigentumswohnung / Einfamilienhaus / Mehrfamilienhaus / Doppelhaushaelfte / Reihenhaus |
| Expose | German term for property listing brochure with photos, description, key facts |
| GEG | Gebaeudeenergiegesetz — energy performance disclosure requirements |
| Grundbuchauszug | Land registry extract required for sale |
| Gutachterausschuss | Local valuation board producing official transaction data |
| GwG | Geldwaeschegesetz — German anti-money-laundering law |
| ICP | Ideal Customer Profile |
| IS24 | ImmobilienScout24, largest German real estate portal |
| Makler | Real estate agent/broker |
| MUST / SHOULD / MAY | RFC 2119 conformance keywords |
| NFR | Non-Functional Requirement |
| Notar | Notary, legally required to certify residential sales in Germany |
| OpenImmo | German XML standard for exchanging real estate listings |
| PortalDriver | Direkta's internal abstraction over third-party portal integrations |
| Reservierungsvereinbarung | Reservation agreement between buyer and seller before the notary appointment |
| SSE | Server-Sent Events, used to stream agent token output to the seller's browser in real time |
| Syndication | The act of distributing one Direkta listing onto external portals via the Listing Agent |
| Teilungserklaerung | Declaration of partition, required for condominium (WEG) sales |
| TTDSG | Telekommunikation-Telemedien-Datenschutz-Gesetz, German implementation of ePrivacy rules |
| WEG | Wohnungseigentuemergemeinschaft, the legal entity of condominium owners |
