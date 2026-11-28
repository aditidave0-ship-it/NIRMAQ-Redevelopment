# NIRMAQ — Data breach notification runbook

**Status: DRAFT — pending Indian privacy counsel review.** This is a working
document for the NIRMAQ team, not final policy. Do not send a breach
notification from it until Indian privacy counsel has reviewed it.

**Source:** Prompt K (27 Nov 2026), from the @thebrokenapp DPDP Act Reel
("on a data breach, notify the impacted users and the Data Protection
Board"). The Reel's headline number is corrected here: ₹250 crore is the
top-end figure for failing reasonable security safeguards — not a flat
penalty for any violation. The tiers below are the verified figures
(Prompt F, 26 Nov 2026).

**Related code:** the two email templates live in
`artifacts/api-server/src/lib/email.ts` — `breachNotificationUserEmail`
(affected users) and `breachNotificationBoardEmail` (the Board's 72-hour
detailed report). **Templates only: there is no sending path, no trigger
and no auto-send anywhere in the codebase.** Sending stays a manual admin
action under this runbook, after counsel review.

---

## 1. What counts as a breach

A breach is any unauthorised access to, loss of, or disclosure of personal
data NIRMAQ holds — for example enquiry details, account and organisation
details, society property information, professional profile information, or
documents a user provided. A suspected breach is treated as a breach until
the team establishes otherwise; do not wait for certainty before starting
this runbook.

## 2. Who detects, who decides

- **Detection — anyone on the NIRMAQ team, or an automated alert.** A team
  member who notices something wrong (an odd admin login, an unexpected
  data export, a user reporting their data elsewhere, an error page
  leaking records) tells the notifier immediately, in writing, with the
  time they noticed it and what they saw. Do not try to fix it quietly
  first.
- **Decision — [OWNER: name the breach decision-maker, e.g. the Founder].**
  The decision-maker confirms whether a breach happened, what data was
  involved, and how many people are affected. Until that decision is made,
  the team preserves evidence: do not delete logs, do not wipe the affected
  system, do not reset anything except to stop ongoing access.
- **Notifier — [OWNER: name the person who sends the notifications, and
  their email and phone].** One named person owns both notifications so
  nothing falls between two owners. If the notifier is unavailable, the
  decision-maker sends them instead — the clock does not wait for a person.

## 3. Notification order — both "without delay"

Both notifications go out **without delay** once the team knows a breach
happened. Where the two cannot go out at the same moment, the order is:

1. **The Data Protection Board first** — because the detailed report has a
   hard 72-hour clock (section 4), and the Board notification starts it.
2. **The affected people next, without delay** — in the same working
   session where possible, never held back until the Board report is
   finished.

"Without delay" means as soon as the team has enough facts to say what
happened and who is affected — hours, not days. A notification is never
delayed to finish a full investigation.

## 4. The Board report — detailed, within 72 hours

Within **72 hours of becoming aware of the breach**, the notifier sends
the Board a detailed report (template: `breachNotificationBoardEmail`).
It must contain:

- the **nature of the breach** — what happened, when, and how it was found;
- the **categories of personal data involved** and the **approximate number
  of people affected**;
- the **likely consequences** for those people (for example, risk of
  phishing if names and email addresses were exposed);
- the **measures taken or proposed** to address the breach and limit its
  effects (access revoked, passwords rotated, the affected system isolated,
  and what is still being done).

The report is a draft the team completes for the real breach — the
template's fields are the checklist, not the answers. Keep a copy of
exactly what was sent, when, and to whom (section 6).

**Board contact route — [OWNER: provide the Board's notification channel
— portal, email or other route — and the account or credentials needed to
use it].** Do not invent a contact route; until the owner provides it,
the team cannot send the Board notification, and that gap is itself a
launch blocker to close with counsel.

## 5. Notifying the affected people

Each affected person gets a notification (template:
`breachNotificationUserEmail`) that says, in plain language:

- **what happened** and when;
- **what data of theirs was involved**;
- **what they should do** (for example, watch for suspicious email, reset
  their password, contact the team);
- **who to contact** — [OWNER: provide the breach contact email] — quoting
  the breach reference number.

Notifications go to the email address NIRMAQ holds for that person. If
email delivery is unavailable (delivery is blocked in production until a
sender domain is approved — see `docs/phase-b-privacy-design.md` §6), the
notifier contacts people by another route the team actually has, and
records how each person was reached. A failed send is never treated as a
sent notification.

## 6. What the 1-year log retention covers, and where the logs live

**Working position — [OWNER: confirm with Indian privacy counsel].** The
1-year retention for breach-related records is the working position
carried from Prompt F (26 Nov 2026); it is not yet in the repo and counsel
must confirm the period and the scope before launch.

What is kept for 1 year from the breach:

- the breach record itself: what happened, when it was found, who decided,
  who was notified, when, and copies of exactly what was sent;
- the privacy-request audit trail for any affected requester
  (`privacy_request_events` — every submission, verification, status
  change, note, hold and fulfilment);
- the platform-wide audit entries for the breach response (`audit_logs` —
  `PRIVACY_REQUEST_UPDATED`, `PRIVACY_REQUEST_VERIFIED`,
  `PRIVACY_REQUEST_NOTE_ADDED` and any breach-response entries);
- application logs for the affected period (pino logs from the API
  server).

Where they live: `privacy_request_events` and `audit_logs` are PostgreSQL
tables in the NIRMAQ database (append-only; application code never updates
or deletes audit rows). Application logs are the API server's pino logs —
[OWNER: confirm where production pino logs are shipped and stored, and
who can read them]. No passwords, OTPs, tokens, token hashes, ID
documents or dates of birth are ever written to any of these logs.

## 7. Penalty tiers (use these, not the Reel's single number)

- Up to **₹250 crore** — failing to take reasonable security safeguards
  to prevent a breach.
- Up to **₹200 crore** — failing to notify the Data Protection Board and
  the affected people of a breach.
- Up to **₹200 crore** — breach of children's-data obligations.

Phase 3 enforcement switches on 13 May 2027.

## 8. Open items (owner / counsel)

- [ ] Named breach decision-maker.
- [ ] Named notifier, with email and phone.
- [ ] The Board's notification channel (portal / email / other) and the
      account or credentials to use it.
- [ ] Breach contact email for affected people.
- [ ] Counsel confirmation of the 1-year log-retention period and scope.
- [ ] Where production pino logs are shipped and stored, and who can read
      them.
- [ ] Counsel review of this runbook and of both email templates.
- [ ] The final privacy notice, retention periods, grievance officer and
      legal entity details (open in Prompt F; not decided here).

## 9. After the breach

Once notifications are sent, the team records the full timeline in the
breach record, fixes the cause, and reviews whether the runbook itself
needs changing. The review, and any change, is recorded with the breach
record — a runbook that was wrong in a real breach is a finding, not a
failure to hide.
