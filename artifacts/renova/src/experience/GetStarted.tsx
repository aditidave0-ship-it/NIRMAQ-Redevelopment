import { Link } from "wouter";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  UsersRound,
} from "lucide-react";
import { ExperienceFooter, ExperienceHeader } from "./Header";
import { GET_STARTED_OPTIONS } from "./get-started";
import type { GetStartedRoleId } from "./get-started";

const ROLE_ICONS: Record<GetStartedRoleId, typeof Building2> = {
  society: Building2,
  developer: BriefcaseBusiness,
  pmc: ClipboardCheck,
  professional: UsersRound,
};

/**
 * Get Started — one stakeholder picker for the whole site (Phase 1,
 * 27 Nov 2026). The header button, the hero button and the "Who Is
 * NIRMAQ For?" cards all land here now, instead of three different
 * places. Registration stays closed (see the note) — this page only
 * routes each role to the working entry that exists today.
 */
export function GetStartedPage() {
  return (
    <div className="renova-experience renova-home-reference">
      <ExperienceHeader />
      <main id="main-content">
        <section className="experience-section experience-container">
          <div className="experience-section-heading">
            <span className="experience-eyebrow">GET STARTED</span>
            <h1>Start with your role.</h1>
            <p>
              Pick who you are. Each path says plainly what happens next —
              and the NIRMAQ team makes the introductions, so nobody assigns
              themselves to a society opportunity.
            </p>
          </div>
          <div className="experience-audiences">
            {GET_STARTED_OPTIONS.map((option) => {
              const Icon = ROLE_ICONS[option.id];
              return (
                <Link
                  key={option.id}
                  href={option.href}
                  className="experience-audience"
                >
                  <span className="experience-icon">
                    <Icon size={26} />
                  </span>
                  <h2>{option.title}</h2>
                  <p>{option.text}</p>
                  <span>
                    {option.action} <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="experience-step-detail">
            <strong>Registration is currently closed</strong> while production
            acceptance checks are completed. For now, societies can check
            feasibility and prepare documents; developers, PMCs and
            professionals can explore what is published. Prefer to talk first?{" "}
            <Link href="/contact">Raise an enquiry</Link> — the team replies
            from info@nirmaq.in.
          </p>
        </section>
      </main>
      <ExperienceFooter />
    </div>
  );
}
