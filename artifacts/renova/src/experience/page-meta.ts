/**
 * Per-page search titles and descriptions (nirmaq.in).
 *
 * The site is a single-page app, so every route serves the same
 * index.html. Without this, Google sees the same bare "NIRMAQ" title
 * on every page. The Router applies getPageMeta on every navigation:
 * document.title, the meta description, and the canonical URL.
 *
 * Titles use only words Aditi has already used for the site —
 * "Redevelopment, Reimagined" is the site's own line — and the
 * descriptions are the pages' own opening lines. Nothing here invents
 * a tagline, a claim, or a figure.
 */

export const SITE_TITLE = "NIRMAQ | Redevelopment, Reimagined";

export const SITE_DESCRIPTION =
  "NIRMAQ connects Mumbai housing societies, developers, PMCs, architects and professionals to make redevelopment simpler and better connected.";

export type PageMeta = {
  title: string;
  description: string;
};

const PAGE_META: Record<string, PageMeta> = {
  "/": { title: SITE_TITLE, description: SITE_DESCRIPTION },
  "/societies": {
    title: "NIRMAQ | For Housing Societies",
    description:
      "Redevelopment guidance for Mumbai housing societies — understand your building's potential, prepare your documents, and meet the right developer.",
  },
  "/societies/how-it-works": {
    title: "NIRMAQ | How It Works for Societies",
    description:
      "How redevelopment works for your society, step by step — from the first feasibility look to the detailed study.",
  },
  "/developers": {
    title: "NIRMAQ | For Developers",
    description:
      "Find the right housing society redevelopment opportunities in Mumbai, and meet societies ready to talk.",
  },
  "/professionals": {
    title: "NIRMAQ | For Professionals",
    description:
      "PMCs, architects, advocates and redevelopment professionals — find the right opportunities in Mumbai.",
  },
  "/ecosystem": {
    title: "NIRMAQ | Ecosystem",
    description:
      "The NIRMAQ ecosystem — housing societies, developers, PMCs, architects and professionals, better connected.",
  },
  "/feasibility-check": {
    title: "NIRMAQ | Feasibility Check",
    description:
      "A first look at your building's redevelopment potential — three short steps, a tentative indication, no figures, no promises. The detailed study is done by the NIRMAQ team.",
  },
  "/societies/intake-form": {
    title: "NIRMAQ | Society Intake Form",
    description:
      "Tell NIRMAQ about your building in plain English — fifteen short fields, under five minutes, no architect needed.",
  },
  "/societies/documents": {
    title: "NIRMAQ | Feasibility Documents",
    description:
      "The eight documents NIRMAQ needs from your society before feasibility preparation can start — give each one, and track what the team has verified.",
  },
  "/feasibility-dashboard": {
    title: "NIRMAQ | Feasibility Dashboard",
    description:
      "Your society's feasibility dashboard — property and society details, documents, members and carpet areas, in one place. The NIRMAQ team reviews every record sent.",
  },
  "/get-started": {
    title: "NIRMAQ | Get Started",
    description:
      "Start with your role — housing society, developer, PMC or professional — and see plainly what happens next on NIRMAQ.",
  },
  "/knowledge-centre/dcpr-2034": {
    title: "NIRMAQ | DCPR 2034 Guide",
    description:
      "DCPR 2034 for Mumbai housing societies — the regulations that shape redevelopment, in plain language.",
  },
  "/knowledge-centre/faqs": {
    title: "NIRMAQ | Frequently Asked Questions",
    description:
      "Answers to the questions housing societies ask most about redevelopment in Mumbai.",
  },
  "/contact": {
    title: "NIRMAQ | Contact",
    description:
      "Talk to the NIRMAQ team about your society's redevelopment — enquiries, feasibility, and guidance.",
  },
  "/privacy": {
    title: "NIRMAQ | Privacy Policy",
    description: "How NIRMAQ handles your information.",
  },
  "/terms": {
    title: "NIRMAQ | Terms of Use",
    description: "The terms for using the NIRMAQ website.",
  },
  "/grievance": {
    title: "NIRMAQ | Grievance Redressal",
    description: "How to raise a grievance with NIRMAQ.",
  },
  "/regulations": {
    title: "NIRMAQ | Regulations",
    description:
      "The regulations that shape housing society redevelopment in Mumbai, in plain language.",
  },
  "/about": {
    title: "NIRMAQ | About",
    description:
      "NIRMAQ connects Mumbai housing societies, developers, PMCs, architects and professionals to make redevelopment simpler and better connected.",
  },
};

/** The search title and description for a route. Unknown routes get the site default — never an empty title. */
export function getPageMeta(pathname: string): PageMeta {
  return PAGE_META[pathname] ?? { title: SITE_TITLE, description: SITE_DESCRIPTION };
}

/** The canonical URL for a route — the one address Google should index for it. */
export function getCanonicalUrl(pathname: string): string {
  return `https://nirmaq.in${pathname === "/" ? "" : pathname}`;
}
