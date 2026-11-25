# NIRMAQ legal-risks audit — 26 Nov 2026 (Prompt F)

**Source:** Instagram Reel by @SURAAJADHIKARY, "VIBE CODING APP? 4 LEGAL RISKS", sent by Aditi 26 Nov 2026.
**Branch:** `codex/prompt-f-legal-risks`, off main `d8a3049`. Draft PR only — never merged, never deployed.
**This is legal information, not legal advice.** Nothing here replaces an advocate's review. The Reel says the same thing: "Ye legal advice nahi hai. Confirm karne ke liye legal expert se baat karo."

---

## The 4 risks, verified against live NIRMAQ

| # | Risk | Reel's claim | Verified |
|---|---|---|---|
| 1 | India — DPDP Act, 2023 | No age check at sign-up = up to ₹200 crore penalty. Under-18 needs parent's consent. In force May 2027. | **Confirmed.** DPDP Rules 2025 phase in; Phase 3 (13 May 2027) switches on substantive obligations, enforcement and penalties. Penalties: up to ₹250 crore for failing reasonable security safeguards, ₹200 crore for failing to notify the Board + affected people of a breach, ₹200 crore for breach of children's-data obligations. Child = under 18. Before processing a child's data: verifiable parental/guardian consent, no tracking, behavioural monitoring or targeted advertising directed at children. Every breach: notify affected people without delay and the Board without delay, detailed report within 72 hours. |
| 2 | Germany — GDPR, Google Fonts | Website fined by a German court for leaking a visitor's IP via Google Fonts. €100 to one visitor. | **Confirmed.** LG München I, 20 Jan 2022, case 3 O 17493/20: dynamic embedding of Google Fonts sent the plaintiff's IP address to a Google server in the US without consent — GDPR Art. 6(1) violation. €100 non-material damages to that one plaintiff, plus an order to stop. Court rejected "legitimate interest" because the fonts could have been self-hosted. Note: €100 was to one person in one case, not €100 per visitor as a schedule. |
| 3 | California — CIPA, session replay | Session replay / chat / form capture = wiretapping claim. $5,000 per violation. Courts divided. | **Confirmed.** CIPA, Cal. Penal Code §§ 630–638, § 631 wiretapping, § 637.2: greater of $5,000 per violation or 3× actual damages, plus fees/injunction, no proof of harm needed. Theory: trackers / session replay / chat widgets sending visitor data to a third party before consent = interception. Courts are genuinely split; SB 690 (signed 30 Sep 2026, from 1 Jan 2027) moves pen-trap claims (§§ 638.50–638.51) to the Attorney General only — § 631 wiretapping claims stay open to private plaintiffs. |
| 4 | USA — CAN-SPAM, email | No unsubscribe link = up to $53,088 per email (FTC max). | **Confirmed (FTC).** CAN-SPAM: each separate email in violation is subject to penalties of up to $53,088. Requirements include: truthful From/To/Reply-To, honest subject, identify as an ad, valid physical postal address, clear opt-out explanation, honour opt-outs promptly (within 10 business days, mechanism working at least 30 days after sending). Transactional/relationship messages are exempt from the opt-out requirement only if their primary purpose fits one of the five categories in the Act. No B2B exception. |

**The Reel's closing point, and it's the right one:** it's not revenue that counts, it's the number of violations — CAN-SPAM per email, CIPA per violation, DPDP up to a cap per category.

**Jurisdiction note:** NIRMAQ is India-focused, so DPDP is the binding law. GDPR / CIPA / CAN-SPAM bite only if/when NIRMAQ has visitors, users or email recipients in the EU / California / US — or when a third-party tool sends their data there. Google Fonts did exactly that (Risk 2), which is why it mattered even for an India-only site.

---

## What was live, what was fixed

### Risk 2 — WAS LIVE, now fixed (Task 1, the priority)

**Before:** the built CSS started with `@import "https://fonts.googleapis.com/css2?family=DM+Mono…&family=DM+Sans…&family=Playfair+Display…"` — every visitor's browser contacted Google and sent its IP address before any consent could be asked. Exactly the LG München I fact pattern.

**Fix (this PR):**
- All three families are now self-hosted under `artifacts/renova/public/fonts/` (10 woff2 files, 216 KB total): DM Sans, DM Mono, Playfair Display, in every subset Google served for the weights used (latin, latin-ext, plus cyrillic + vietnamese for Playfair Display).
- DM Sans and Playfair Display are variable fonts — Google serves one file per subset covering the whole weight range, so each subset is stored once and declared with a weight range (`DM Sans: 100 1000`, `Playfair Display: 400 900`, verified with fontTools `fvar` tables). DM Mono is static, so it keeps one file per weight (400, 500). This also renders the site's non-standard `font-weight: 620` exactly, as Google served it — a static per-weight file could not.
- The Google Fonts `@import` is deleted from `artifacts/renova/src/index.css` and replaced with local `@font-face` rules pointing at `/fonts/…`. Family names are unchanged (`'DM Sans'`, `'DM Mono'`, `'Playfair Display'`), so no component or style needed to change.
- **Regression guard:** `artifacts/renova/tests/no-external-fonts.test.mjs` — fails if any source file references `fonts.googleapis.com`, `fonts.gstatic.com` or `googleapis.com`; checks the 10 woff2 files exist, are valid woff2 (`wOF2` magic) and are referenced by `index.css`; and, when `dist/` exists, fails if any built asset references an external font host.

**Verified (this PR, not just in source):**
- Production build passes; built CSS contains 10 `@font-face` rules, all `url(/fonts/…)`; `dist/public/fonts/` holds the 10 files.
- Grep of the whole `dist/` tree for `fonts.googleapis` / `fonts.gstatic` / `googleapis`: **zero hits**.
- Playwright drive-through with Google's hosts blocked (requests aborted): the homepage renders identically (screenshot: `~/workspace/goals/revora-redevelopment-platform/files/prompt-f-homepage-offline-2026-11-26.png`), `document.fonts.load` succeeds for DM Sans 400/700, DM Mono 500 and Playfair Display 600, all served from `/fonts/`, **zero requests to any Google host**. (First check showed DM Sans/DM Mono as "not loaded" — that was lazy loading: the visible homepage text only needed Playfair at that moment. The explicit `document.fonts.load` proves all three families load locally.)

### Risk 3 — NOT PRESENT. Verified absent in code and in the built output

- No session-replay, Hotjar / FullStory / Clarity / LogRocket / PostHog / rrweb, no chat widget, no form-capture tool, no analytics of any kind (no gtag / Google Analytics / Facebook pixel / Plausible / Matomo / Umami). Grep of `artifacts/renova/src`, `index.html`, `artifacts/api-server/src` and the built JS bundle: zero hits.
- The "clarity" strings in the JS bundle are marketing copy only ("Clarity before commitment.", "Commercial clarity") — not Microsoft Clarity. Do not "fix" the copy.
- **Preventive rule:** do not add session replay, chat widgets, form-capture tools or any analytics without prior consent handling and an entry in the third-party inventory below.

### Risk 1 — PARTLY DONE (Phase B). The hard parts are built; the paper parts are not

**Already on main (PR #43, merged 13 Nov 2026) — verified in code:**
- One required 18+ checkbox on registration: `name="ageAttestation"` — "I confirm that I am 18 years of age or older and I am creating a NIRMAQ account." (`artifacts/renova/src/platform/LiveWorkspace.tsx:390`). Backend rejects registration without it: `ageAttestation: z.literal(true, …)` in `artifacts/api-server/src/routes/auth.ts:75` (400).
- Consent ledger: `privacy_consent_events`, `artifacts/api-server/src/lib/consent-policy.ts` — consent is recorded per purpose, withdrawal is a new `WITHDRAWN` event (append-only, nothing is updated or deleted), admin-only privacy queue, org isolation, erasure safety for legal/financial/security holds, never log passwords/OTPs/tokens/ID docs.
- No tracking / behavioural monitoring / targeted advertising directed at under-18s anywhere: there is no analytics or tracking on the site at all (see Risk 3).

**Still open — do not invent:**
- The 9 footer/policy items from the 22 Nov research — Privacy Policy (DPDP standard), Terms of Use, Refund & Cancellation, Cookie Policy, Disclaimer (feasibility/no-advice + RERA note), Grievance Redressal, Copyright/IP & Takedown, Accessibility Statement, Company & Legal Information. Drafting is blocked on Aditi's company facts (see "Still needs Aditi").
- A named grievance officer (acknowledge 24–48h, resolve 15 days–1 month).
- A breach-notification runbook: who notifies the Board + affected people, without delay, detailed report within 72 hours, and what the 1-year log retention covers.

### Risk 4 — NOT PRESENT YET. No marketing email exists to violate it

**Verified in code** (`artifacts/api-server/src/lib/email.ts`, sent server-side via the Resend API — the browser never contacts Resend): NIRMAQ sends exactly **7 transactional templates, nothing else**:

| Template | Purpose | Commercial? |
|---|---|---|
| Verify your email (OTP) | Account email verification | No |
| Welcome to NIRMAQ | Account active after verification | No |
| Enquiry received (ack to enquirer) | Enquiry acknowledgement | No |
| New enquiry (to info@nirmaq.in) | Admin notification | No |
| Reset your password | Password reset | No |
| Verify your privacy request | Privacy-request verification | No |
| Update on your privacy request | Privacy-request status | No |

- No marketing list, no bulk mail, no marketing template. No "unsubscribe" string anywhere in the codebase (grep of `artifacts/api-server/src`, `artifacts/renova/src`, `index.html`: zero hits). No template carries a physical postal address.
- **Rule for the future:** any commercial/marketing email must carry, before it is ever sent: truthful sender headers, honest subject, ad identification, a real physical postal address, and a clear one-click opt-out that works for at least 30 days and is honoured within 10 business days. Never send marketing mail to a bought list. Keep transactional and marketing mail on separate templates so a transactional message never accidentally becomes a commercial one. **Flag:** the Welcome email is the most likely to drift commercial — if it ever gains promotional content, it stops being transactional and needs CAN-SPAM headers.

---

## Third-party inventory (every page, what loads on page load)

Checked on 26 Nov 2026 against main `d8a3049` + this PR, in source and in the built output. "Loads" means the visitor's browser fetches it; outbound links a visitor taps are listed separately.

| Third party | What it receives | When it loads | Verdict |
|---|---|---|---|
| Google Fonts (fonts.googleapis.com / fonts.gstatic.com) | Visitor IP + user agent, before consent | Was: every page load, via CSS `@import` | **Removed by this PR — now self-hosted from `/fonts/`** |
| Resend API (api.resend.com) | Enquiry / account email content | Server-side only, when the backend sends mail — the browser never contacts it | Keep; transactional only |
| Everything else | — | — | **Nothing.** No external scripts, no iframes, no external images, no analytics, no chat, no pixel, no form-capture. All `fetch()` calls are same-origin `/api/*`. |

**Outbound links only (the site fetches nothing from these; a visitor's browser contacts them only if they tap):**
- Developer/company websites in `artifacts/renova/src/data/organizations.ts`, rendered as plain `<a href={organization.website}>` links in the directory.
- `maps.app.goo.gl` links: the Dharma Nagar demo society's stored Google location, and the placeholder example text in the documents form.
- `nirmaq.in` canonical / Open Graph links — NIRMAQ's own domain.

---

## What this PR does NOT do

- No Privacy Policy / Terms / Cookie Policy drafted here — those need Aditi's company facts and an advocate's review first. They are listed as blocked below, with exactly what fact is missing for each.
- No production change: no deploy, no DB change, no migration, no secret, no payment. The enquiry-email fix is untouched (on hold until Aditi says feasibility is closed). No Phase 3 work.
- No change to the intro video, the homepage design, the logo, or any page's look — fonts render identically, from local files.

---

## Still needs Aditi / an advocate

1. **Company facts for the policies** (asked 22 Nov, still open): legal entity name, CIN/GSTIN, registered address, grievance officer's name. Without these, the Privacy Policy / Terms / Grievance page can't be drafted properly.
2. **Advocate review:** before the 9 policy items are published, and before any marketing email is ever sent.
3. **Breach-notification runbook** (owner + legal): who notifies the Board + affected people, the 72-hour detailed report, and what the 1-year log retention covers.
4. **Grievance officer:** a named person, with acknowledge-in-24–48h / resolve-in-15-days–1-month commitments.

---

## Verification (Prompt F acceptance)

- Typecheck: clean (`tsc --noEmit`, exit 0).
- Production build: passes (Vite, 8.69s).
- Tests: full suite run (see PR report for the final count) — includes the new `tests/no-external-fonts.test.mjs` (3/3).
- Built-asset grep: zero references to `fonts.googleapis` / `fonts.gstatic` / `googleapis` in `dist/`.
- Offline render: Playwright, Google hosts blocked — homepage renders identically, all three families load from `/fonts/`, zero Google requests.
- Audit: third-party inventory, session-replay absence, age-attestation enforcement, consent ledger, and the 7 email templates all checked in code (file:line cited above) and, for the font fix, in the built output.
