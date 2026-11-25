import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { ExperienceFooter, ExperienceHeader } from "./Header";

/**
 * DCPR 2034 knowledge-centre guide for housing societies.
 *
 * Consulting-first by design: the page explains the framework in plain
 * language (the map), while what applies to a specific building is the
 * NIRMAQ team's detailed study (the paid work). Content is summarised
 * from published guidance on DCPR 2034 and must be read with the
 * disclaimer on the page — figures are indicative summaries, not legal
 * advice and not a promise for any specific plot.
 */

type RegulationCard = {
  code: string;
  name: string;
  appliesTo: string;
  enables: string;
  ask: string;
};

const REGULATION_CARDS: RegulationCard[] = [
  {
    code: "33(7)",
    name: "Cessed buildings",
    appliesTo:
      "Buildings in the Island City that were built before 30 September 1969 and pay the MHADA repair cess — the classic old-city tenanted stock.",
    enables:
      "In broad terms, FSI up to 3.0, or the rehab area plus an incentive of 50%, 60% or 70% depending on whether plots are combined. Member homes can grow by roughly 5%, 8% or 15% in carpet area (subject to minimum and maximum limits), with fungible area on top.",
    ask: "Is our building on the cessed list — and would combining with a neighbouring plot move us into a better incentive slab?",
  },
  {
    code: "33(7)(A)",
    name: "Dilapidated tenant-occupied buildings",
    appliesTo:
      "Authorised, tenant-occupied buildings in the suburbs and extended suburbs that have been declared dilapidated or unsafe — and non-cessed tenant-occupied buildings in the City. Both conditions must hold together: dilapidated/unsafe and tenant-occupied.",
    enables:
      "Broadly the same incentive structure as 33(7): the rehab area plus 50%, 60% or 70%, with a similar carpet-area increase for members.",
    ask: "Does our structural audit position actually qualify us — and is our occupancy pattern eligible under this clause rather than another?",
  },
  {
    code: "33(7)(B)",
    name: "Housing societies over 30 years old",
    appliesTo:
      "Existing residential housing societies that are more than 30 years old and do not fall under 33(7) or 33(7)(A). This is the clause most suburban societies actually redevelop under — suburban buildings are not 33(7), whatever an offer letter may claim.",
    enables:
      "An incentive equal to the higher of 15% of the authorised built-up area or 10 sq.m per member. The catch committees miss: the incentive must fit within the permissible FSI for your plot and road width — it is not added on top of it.",
    ask: "What is our permissible FSI given our road width, and how much of the incentive can it genuinely absorb?",
  },
  {
    code: "33(9)",
    name: "Cluster redevelopment",
    appliesTo:
      "Neighbouring buildings and plots that come together and redevelop as one cluster or urban-renewal scheme instead of going alone.",
    enables:
      "Up to 4.0 FSI, or the rehab area plus incentive, whichever is more — with the shared benefits of a larger scheme: better amenities, wider roads and township-style planning. A minimum combined plot size applies, and the threshold depends on whether the cluster sits in the City or the suburbs — NIRMAQ confirms the exact threshold for your cluster in the feasibility study.",
    ask: "Who are our realistic cluster partners, and what road width fronts the combined plot?",
  },
  {
    code: "33(5)",
    name: "MHADA layouts",
    appliesTo:
      "Buildings inside notified MHADA layouts — a separate route from the society clauses above.",
    enables:
      "Redevelopment under the MHADA layout framework rather than the general society provisions. Whether your layout is on the notified list decides this route, so it is checked first, before any numbers are discussed.",
    ask: "Is our layout on the notified MHADA list — and if it is, how does that change our options?",
  },
  {
    code: "33(10)",
    name: "Slum rehabilitation (SRA)",
    appliesTo:
      "Slum rehabilitation schemes under the Slum Rehabilitation Authority. Most housing societies will not redevelop under this clause, but mixed-tenure neighbourhoods meet it often.",
    enables:
      "Rehabilitation through the SRA framework, with its own eligibility and consent rules, distinct from the society redevelopment clauses.",
    ask: "Does any part of our plot or neighbourhood fall under SRA — and what would that mean for the society's own plans?",
  },
];

const JOURNEY_STAGES: Array<{ title: string; detail: string }> = [
  {
    title: "Members call the meeting",
    detail:
      "A group of members requisitions a special general meeting (SGM) under Section 79A of the Maharashtra Co-operative Societies Act, so redevelopment is formally on the society's agenda.",
  },
  {
    title: "Appoint advisors first",
    detail:
      "The society takes quotations and appoints its architect and project management consultant before talking seriously to any developer — advice comes before offers.",
  },
  {
    title: "Feasibility and alignment",
    detail:
      "The appointed team studies the plot, the applicable regulation and the numbers, and members align on what they want before a tender goes out.",
  },
  {
    title: "The deciding SGM",
    detail:
      "Members vote at the SGM to proceed and to select the developer, with the quorum and approval the current procedure requires — every decision minuted and recorded.",
  },
  {
    title: "Agreements, registered",
    detail:
      "A development agreement with the developer, followed by registered permanent alternate accommodation agreements (PAAAs) for individual members.",
  },
  {
    title: "Approvals, then vacate",
    detail:
      "Members vacate only after the project approvals are in place and the PAAAs are registered — never on a promise alone.",
  },
  {
    title: "Construction to handover",
    detail:
      "Building approvals (IOD/CC), construction, the occupation certificate, and handover of the new homes.",
  },
];

export function DcprGuidePage() {
  return (
    <div className="renova-experience">
      <ExperienceHeader />
      <main id="main-content" className="experience-container experience-info-page">
        <span className="experience-eyebrow">Knowledge centre · DCPR 2034</span>
        <h1>DCPR 2034, in plain language.</h1>
        <p>
          The Development Control and Promotion Regulations 2034 — DCPR 2034 —
          are Greater Mumbai&rsquo;s planning rulebook. They decide what may be
          built on a plot: how much floor space, under which conditions, and
          with what incentives. For a housing society, one question matters
          before all others: <strong>which regulation applies to our
          building?</strong> The answer shapes everything that follows — the
          FSI framework, the incentive, and what a developer can credibly
          offer you.
        </p>
        <p>
          This page is the map. It explains the regulations societies meet
          most often, in plain language. Which one applies to{" "}
          <em>your</em> building — and what it is worth on your plot — is what
          NIRMAQ works out in a detailed feasibility study.
        </p>

        <section className="experience-dcpr-section">
          <h2>The regulations that matter</h2>
          <div className="experience-dcpr-grid">
            {REGULATION_CARDS.map((card) => (
              <article key={card.code} className="experience-dcpr-card">
                <h3>
                  Regulation {card.code} — {card.name}
                </h3>
                <p>
                  <strong>Applies to:</strong> {card.appliesTo}
                </p>
                <p>
                  <strong>What it broadly enables:</strong> {card.enables}
                </p>
                <p className="experience-dcpr-ask">
                  <strong>Ask NIRMAQ:</strong> {card.ask}
                </p>
              </article>
            ))}
          </div>
          <p className="experience-dcpr-note">
            A related route worth knowing: Regulation 33(20A) covers MHADA
            societies up to 4,000 sq.m under the Premium Policy, summarised in
            current guidance as the rehab area plus a 15% incentive. If your
            society is a MHADA colony, ask us about it specifically.
          </p>
        </section>

        <section className="experience-dcpr-section">
          <h2>The 79A journey, in brief</h2>
          <p>
            Whichever regulation applies, the society&rsquo;s own decision
            process follows Section 79A of the Maharashtra Co-operative
            Societies Act. In outline:
          </p>
          <ol className="experience-dcpr-stages">
            {JOURNEY_STAGES.map((stage) => (
              <li key={stage.title}>
                <h3>{stage.title}</h3>
                <p>{stage.detail}</p>
              </li>
            ))}
          </ol>
          <p>
            Parts of this procedure were updated by a government order in
            2026. NIRMAQ works to the current order and confirms the exact
            steps, thresholds and timelines in force for your society before
            your committee acts on them.
          </p>
        </section>

        <section className="experience-dcpr-section">
          <h2>Corpus and transit rent, explained</h2>
          <div className="experience-dcpr-grid">
            <article className="experience-dcpr-card">
              <h3>The corpus fund</h3>
              <p>
                A fund the developer pays for members&rsquo; future security —
                meant to help the society carry costs like property tax and
                maintenance after redevelopment. Published guidance commonly
                cites corpus in the range of a few lakh rupees per member,
                varying with the regulation and locality.
              </p>
              <p>
                The amount is negotiated, not fixed by law — so the schedule
                matters as much as the sum: corpus is paid in tranches, and
                the first tranche should fall due when you vacate, not when
                approvals arrive.
              </p>
            </article>
            <article className="experience-dcpr-card">
              <h3>Transit rent</h3>
              <p>
                The monthly rent the developer pays while you are out of your
                home. It should match rents in your own neighbourhood — not a
                cheaper one — with an annual escalation written into the
                agreement, starting on the agreed date, with the first cheque
                in hand before you vacate.
              </p>
              <p>
                The most common dispute in redevelopment: rent that stops
                while possession is still months away. Your agreement must
                answer it in advance — escalation, delay penalty, and a bank
                guarantee backing the developer&rsquo;s obligations, as
                decided by your general body and written into the agreement.
              </p>
            </article>
            <article className="experience-dcpr-card">
              <h3>Shifting and hardship</h3>
              <p>
                Moving out and moving back in both cost money — transport,
                brokerage, deposits. Agreements typically include a one-time
                shifting or hardship amount per member; published guidance
                commonly cites ₹50,000 to ₹2 lakh.
              </p>
              <p>
                Check that it covers both journeys, not just the move out,
                and whether a developer-provided transit home is offered
                instead of rent — the two are not the same thing.
              </p>
            </article>
          </div>
        </section>

        <p className="experience-dcpr-disclaimer">
          General information to help societies understand the framework —
          not legal advice. NIRMAQ confirms what applies to your building in
          a detailed study.
        </p>

        <div className="experience-dcpr-cta">
          <h2>Which regulation applies to your building?</h2>
          <p>
            That single answer decides your society&rsquo;s negotiating
            position. NIRMAQ&rsquo;s feasibility study confirms it from your
            sanctioned plans, cess and layout records, and road width — and
            turns it into numbers your committee can act on.
          </p>
          <Link className="experience-button" href="/societies">
            Take the tentative feasibility check first
            <ArrowRight size={16} />
          </Link>
          <Link
            className="experience-text-link"
            href="/contact?subject=Society%20feasibility"
          >
            Prefer to talk first? Raise an enquiry →
          </Link>
        </div>
      </main>
      <ExperienceFooter />
    </div>
  );
}
