/**
 * Get Started (/get-started) — the one clear starting journey.
 *
 * Phase 1 of the existing-website improvement project (27 Nov 2026):
 * one stakeholder picker instead of three separate entry points (the
 * header button, the hero button, and the "Who Is NIRMAQ For?" cards
 * each went somewhere different). Each card names what happens next
 * and points at the working entry for that role — no new backend, no
 * new registration flow.
 *
 * Honesty rules for this page:
 * - Public registration is currently closed while production
 *   acceptance checks are completed (see the note on the page). No
 *   card promises an account, a workspace, or a match.
 * - Societies start with the public feasibility check (the 3-step
 *   teaser) — the full dashboard follows from there. Developers,
 *   PMCs and professionals start on their existing pages.
 * - Stakeholders express interest; the NIRMAQ team makes the
 *   introductions. Nobody assigns themselves to a society
 *   opportunity from here.
 */

export type GetStartedRoleId = "society" | "developer" | "pmc" | "professional";

export type GetStartedOption = {
  id: GetStartedRoleId;
  title: string;
  text: string;
  action: string;
  href: string;
};

export const GET_STARTED_OPTIONS: readonly GetStartedOption[] = [
  {
    id: "society",
    title: "Housing Society",
    text: "Your society's redevelopment, guided end to end — start with a three-step feasibility check.",
    action: "Check your feasibility",
    href: "/feasibility-check",
  },
  {
    id: "developer",
    title: "Developer",
    text: "See published society briefs and express interest — the NIRMAQ team makes the introduction.",
    action: "Explore developer opportunities",
    href: "/developers",
  },
  {
    id: "pmc",
    title: "PMC",
    text: "Bring project management expertise to societies the team is guiding.",
    action: "Explore PMC opportunities",
    href: "/professionals/pmcs",
  },
  {
    id: "professional",
    title: "Professional",
    text: "Introduce your practice — architects, advocates and specialists the team calls on.",
    action: "Explore professional opportunities",
    href: "/professionals",
  },
];
