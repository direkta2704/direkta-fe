# Direkta — Remaining Work (vs. Lastenheft v1.2)

## Status: May 1, 2026

---

## COMPLETED ✅

### M1 — Smart Listing Creation
- ✅ Property wizard (type, address, details, energy cert, review)
- ✅ Photo upload (6-30, JPEG/PNG, max 25MB)
- ✅ AI text generation (long description + short summary)
- ✅ Energy certificate (PDF upload + manual entry)
- ✅ Compliance check blocks publish on failure
- ✅ Seller can edit all AI text before publishing
- ⚠️ Address validation (Nominatim — falls back gracefully)
- ❌ Photo enhancement (perspective, white balance) — NOT BUILT
- ❌ Quality score (0-100) display — NOT BUILT

### M2 — Pricing Engine
- ✅ Price band (low/median/high)
- ✅ Three strategies (Quick/Realistic/Maximum)
- ✅ Comparable transactions (synthetic, with similarity scores)
- ✅ Confidence indicator (High/Medium/Low)
- ✅ Seller can override price
- ✅ Deterministic, re-derivable
- ❌ Market trends per postcode (24-month €/m² chart) — NOT BUILT

### M3 — Lead Funnel & Qualification
- ✅ Unique SEO landing pages per listing
- ✅ Buyer enquiry form (no account required)
- ✅ Lead quality score (0-100, documented formula)
- ✅ Ranked lead list sorted by score
- ✅ Viewing scheduling with .ics invites
- ✅ Lead deduplication by email
- ⚠️ Auto-qualification email within 5 min — PARTIAL (email sends but no structured follow-up questions)
- ❌ Portal enquiry parsing (IS24/Immowelt email → Lead) — NOT BUILT
- ❌ GEG fields visible above fold audit — NOT VERIFIED

### M4 — Offer Dashboard
- ✅ Structured offer submission (amount, financing, conditions)
- ✅ Offer scoring (amount, financing, timing, risk + composite)
- ✅ Side-by-side comparison (2-3 offers)
- ✅ Accept/reject/counter-offer workflow
- ✅ Reservierungsvereinbarung PDF generation
- ✅ Notary document checklist
- ✅ Buyer contact info (phone, email, WhatsApp)
- ❌ Buyer ID verification (manual review workflow) — NOT BUILT
- ❌ Notary suggestions by Bundesland — NOT BUILT

### M5 — Exposé Agent
- ✅ Multi-turn German dialog
- ✅ One question per turn (enforced)
- ✅ Bulk data extraction (paste all at once)
- ✅ 7-tool registry (address, energy, pricing, photo, draft, review, handoff)
- ✅ Quality rubric self-review (6 criteria)
- ✅ Photo upload inline in conversation
- ✅ Energy PDF extraction
- ✅ Handoff creates Property + Listing
- ✅ Cost tracking (MAX_COST = €2/run)
- ✅ Agent step audit trail
- ✅ Conversation resume within 24h
- ✅ Multi-unit MFH support
- ✅ Selling mode (Individual/Bundle/Both)
- ✅ Floor plan upload
- ✅ Voice input
- ✅ Auto-continue after photos
- ⚠️ Exposé PDF generation — WORKS (but quality varies)
- ⚠️ Skip back and revise earlier answers — PARTIAL (edit exists but limited)

### M6 — IS24 Syndication
- ✅ IS24 REST API driver (OAuth 1.0a) — replaces browser automation
- ✅ PortalDriver abstraction (IS24ApiDriver, IS24BrowserDriver, IS24MockDriver)
- ✅ Publish, update, pause, withdraw
- ✅ Credential encryption (AES-256-GCM)
- ✅ Consent dialog + 90-day reconfirmation
- ✅ Rate limiting (1 action/8s)
- ✅ Photo upload to IS24
- ✅ Floor plan upload (PDF as PDFDocument)
- ✅ Energy cert, contact, attributes sent
- ⚠️ Stats sync — API exists but sandbox doesn't persist
- ⚠️ Lead ingestion — Schema ready, no active ingestion
- ❌ Circuit breaker (25% failure rate → auto-pause) — NOT BUILT
- ❌ IS24 enquiry email parsing into Leads — NOT BUILT

### Authentication
- ✅ Email + password registration/login
- ✅ Account deletion (GDPR Art. 17)
- ❌ Magic link (passwordless) login — NOT BUILT
- ❌ Email verification before publish — NOT BUILT
- ❌ Password reset — NOT BUILT
- ❌ Social login (Google, Apple) — NOT BUILT (OAuth configured but not wired)

### Cross-cutting
- ✅ All seller UI in German
- ✅ Cookie banner with consent (TTDSG)
- ✅ Impressum, Datenschutz, AGB, Widerrufsrecht pages
- ✅ Immutable event log per listing
- ✅ GDPR data export (JSON + PDF)
- ✅ PostHog analytics (activated)
- ✅ Payments (Stripe — flat fee + success fee)
- ✅ S3 media storage (migrated from local)
- ✅ Email sending (Nodemailer/SMTP)
- ❌ Sentry error monitoring — NOT CONFIGURED
- ❌ Support escalation (2 clicks) — NOT BUILT
- ❌ Branded GDPR-compliant emails with unsubscribe — PARTIAL

### UI Features (added beyond spec)
- ✅ Enhanced listings page (12 features: search, sort, bulk actions, thumbnails, etc.)
- ✅ Enhanced viewings page (stats, recurring slots, notes, contact buttons)
- ✅ Enhanced offers page (counter-offer, buyer contact, commission saved)
- ✅ Enhanced dashboard (next action hints, expose agent shortcut)
- ✅ Auto-create listings on sales mode selection
- ✅ Auto-cascade data (energy cert, photos) to child units
- ✅ Auto-withdraw on sale (package ↔ individual)
- ✅ Price consistency warning
- ✅ Inline property details editing
- ✅ Listing duplicate functionality

---

## NOT BUILT — Priority Order

### P0 — Must have before beta (blocking)

| # | Feature | Spec Ref | Effort |
|---|---|---|---|
| 1 | Email verification before publish | F-AUTH-02 | 2 hr |
| 2 | Password reset via email | F-AUTH-03 | 2 hr |
| 3 | Magic link login | F-AUTH-01 | 3 hr |
| 4 | Sentry error monitoring | §12.7 | 1 hr |
| 5 | Auto-qualification email to buyer (3 structured questions) | F-M3-04 | 4 hr |
| 6 | Circuit breaker for IS24 syndication | F-M6-12 | 3 hr |

### P1 — Should have for launch

| # | Feature | Spec Ref | Effort |
|---|---|---|---|
| 7 | Social login (Google, Apple) | F-AUTH-04 | 3 hr |
| 8 | Photo enhancement (perspective, brightness) | F-M1-05 | 8 hr |
| 9 | Listing quality score (0-100) | F-M1-09 | 3 hr |
| 10 | Market trends per postcode | F-M2-07 | 6 hr |
| 11 | IS24 lead ingestion (parse IS24 enquiry emails) | F-M6-08 | 6 hr |
| 12 | IS24 daily stats sync job | F-M6-07 | 4 hr |
| 13 | Support escalation button (2 clicks) | F-X-05 | 1 hr |
| 14 | Buyer ID verification workflow | F-M4-02 | 6 hr |
| 15 | Notary suggestions by Bundesland | F-M4-07 | 2 hr |
| 16 | Branded email templates with unsubscribe | F-X-02 | 4 hr |

### P2 — Nice to have

| # | Feature | Spec Ref | Effort |
|---|---|---|---|
| 17 | Portal enquiry email parsing | F-M3-08 | 6 hr |
| 18 | GEG above-fold audit | F-M3-02 | 2 hr |
| 19 | Argon2id password hashing (currently bcrypt) | §12.3 | 1 hr |
| 20 | SSE streaming for agent responses | §9.5 | 8 hr |
| 21 | OpenGraph/schema.org structured data | §16.1 | 3 hr |
| 22 | Sitemap.xml auto-generation | §16.1 | 2 hr |
| 23 | Server-side GTM / conversion tracking | §16.3 | 4 hr |

---

## Summary

| Category | Total Reqs | Done | Remaining |
|---|---|---|---|
| M1 — Listing Creation | 9 | 7 | 2 |
| M2 — Pricing Engine | 7 | 6 | 1 |
| M3 — Lead Funnel | 8 | 5 | 3 |
| M4 — Offer Dashboard | 7 | 5 | 2 |
| M5 — Exposé Agent | 12 | 11 | 1 |
| M6 — IS24 Syndication | 14 | 10 | 4 |
| Auth | 6 | 2 | 4 |
| Cross-cutting | 5 | 3 | 2 |
| **Total** | **68** | **49 (72%)** | **19 (28%)** |

**Estimated remaining effort: ~80 hours (2 weeks for 1 engineer)**
