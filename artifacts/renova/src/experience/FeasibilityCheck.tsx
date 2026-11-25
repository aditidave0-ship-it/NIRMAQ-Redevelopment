import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, ClipboardCheck } from "lucide-react";
import { ExperienceFooter, ExperienceHeader } from "./Header";
import {
  assessTentativeFeasibility,
  TENTATIVE_FEASIBILITY_DISCLAIMER,
} from "./tentative-feasibility";
import type { TentativeFeasibilityResult } from "./tentative-feasibility";
import { getTeaserSensitivityNotes } from "./feasibility-check";
import type { ExtraAreaChoice, TeaserScheme } from "./feasibility-check";

/**
 * Public teaser feasibility check (/feasibility-check).
 *
 * A 3-step wizard in the uploaded NIRMAQ.IN engine's shape — your
 * building, then scheme & rates, then the outlook — but the outlook
 * itself is only the reviewed public scorer (assessTentativeFeasibility):
 * a qualitative band with plain-language reasons, no rupee figures, no
 * areas, no FSI/TDR numbers, no return estimates. Step 2 only adds
 * plain-language notes about the scheme the visitor picked and the extra
 * area they asked for; it never moves the band. Nothing is submitted,
 * stored or sent anywhere — all state is local. The full assessment,
 * with real numbers, is a NIRMAQ team workflow.
 */

type TeaserStep = 1 | 2 | 3;

const SCHEMES: Array<{
  id: TeaserScheme;
  code: string;
  name: string;
  detail: string;
}> = [
  {
    id: "33_7_B",
    code: "33(7)(B)",
    name: "Housing societies over 30 years old",
    detail:
      "Existing residential housing societies that are more than 30 years old and do not fall under 33(7) or 33(7)(A). This is the clause most suburban societies actually redevelop under.",
  },
  {
    id: "33_11",
    code: "33(11)",
    name: "SRA clubbing",
    detail:
      "A route where a scheme is combined with slum rehabilitation tenements. Whether it is open to your building — and what it would cost — is confirmed in the detailed study, not assumed here.",
  },
  {
    id: "not_sure",
    code: "Not sure yet",
    name: "Not sure which applies",
    detail:
      "That is fine — establishing which regulation applies is the first thing the detailed study does.",
  },
];

const EXTRA_AREA_OPTIONS: Array<{ value: ExtraAreaChoice; label: string }> = [
  { value: 0, label: "None" },
  { value: 10, label: "About 10% more" },
  { value: 20, label: "About 20% more" },
  { value: 30, label: "30% or more" },
];

const STEP_LABELS: Record<TeaserStep, string> = {
  1: "Step 1 of 3 — Your building",
  2: "Step 2 of 3 — Scheme & rates",
  3: "Step 3 of 3 — Your tentative outlook",
};

export function FeasibilityCheckPage() {
  const [step, setStep] = useState<TeaserStep>(1);
  const [plotArea, setPlotArea] = useState("");
  const [homeCount, setHomeCount] = useState("");
  const [avgHomeSize, setAvgHomeSize] = useState("");
  const [buildingAge, setBuildingAge] = useState("");
  const [scheme, setScheme] = useState<TeaserScheme>("not_sure");
  const [localityRate, setLocalityRate] = useState("");
  const [extraArea, setExtraArea] = useState<ExtraAreaChoice>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TentativeFeasibilityResult | null>(
    null,
  );

  function handleStep1Submit(event: FormEvent) {
    event.preventDefault();
    const plot = Number.parseFloat(plotArea);
    const homes = Number.parseFloat(homeCount);
    const avgSize = Number.parseFloat(avgHomeSize);
    const age = Number.parseFloat(buildingAge);
    if (
      !Number.isFinite(plot) ||
      plot <= 0 ||
      !Number.isFinite(homes) ||
      homes <= 0 ||
      !Number.isFinite(avgSize) ||
      avgSize <= 0 ||
      !Number.isFinite(age) ||
      age < 0
    ) {
      setError(
        "Please enter your plot area, number of homes, average home size and building age.",
      );
      return;
    }
    setError(null);
    setStep(2);
  }

  function handleStep2Submit(event: FormEvent) {
    event.preventDefault();
    const plot = Number.parseFloat(plotArea);
    const homes = Number.parseFloat(homeCount);
    const avgSize = Number.parseFloat(avgHomeSize);
    const age = Number.parseFloat(buildingAge);
    const rate = Number.parseFloat(localityRate);
    setError(null);
    const assessed = assessTentativeFeasibility({
      plotAreaSqft: plot,
      homeCount: homes,
      avgHomeCarpetSqft: avgSize,
      buildingAgeYears: age,
      localityRatePerSqft: Number.isFinite(rate) && rate > 0 ? rate : null,
    });
    setResult(assessed);
    // Carry only the tentative indication (a display hint, never a
    // substitute for the enquiry) to the documents dashboard in this
    // same visit, so the society sees one journey: check → documents →
    // enquiry. The enquiry itself still goes through the real API.
    try {
      window.sessionStorage.setItem(
        "nirmaq.tentativeBand",
        JSON.stringify({ band: assessed.band, bandLabel: assessed.bandLabel }),
      );
    } catch {
      // Storage unavailable — the documents page simply shows no banner.
    }
    setStep(3);
  }

  function handleStartAgain() {
    setStep(1);
    setPlotArea("");
    setHomeCount("");
    setAvgHomeSize("");
    setBuildingAge("");
    setScheme("not_sure");
    setLocalityRate("");
    setExtraArea(0);
    setError(null);
    setResult(null);
  }

  const notes = getTeaserSensitivityNotes(scheme, extraArea);

  return (
    <div className="renova-experience">
      <ExperienceHeader />
      <main
        id="main-content"
        className="experience-container experience-info-page"
      >
        <span className="experience-eyebrow">
          For housing societies · Tentative feasibility check
        </span>
        <h1>A first look at your building&rsquo;s redevelopment potential.</h1>
        <p>
          Three short steps — your building, then the scheme and rates, then
          your tentative outlook. This is a first look only: it shows an
          indication, not figures, and never an area, entitlement or return.
          The detailed study, with real numbers, is done by the NIRMAQ team.
        </p>
        <p>
          <Link href="/societies">← Back to the societies page</Link>
          {" · "}
          <Link href="/knowledge-centre/dcpr-2034">
            Read the DCPR 2034 guide →
          </Link>
        </p>

        <section
          className="experience-tentative"
          aria-label="Tentative feasibility check"
        >
          <span className="experience-eyebrow">{STEP_LABELS[step]}</span>

          {step === 1 && (
            <form
              className="experience-tentative-card"
              onSubmit={handleStep1Submit}
            >
              <h2>Your building</h2>
              <div className="experience-form-row">
                <label>
                  Plot area (sq.ft)
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 18000"
                    value={plotArea}
                    onChange={(event) => setPlotArea(event.target.value)}
                  />
                </label>
                <label>
                  Number of existing homes
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 40"
                    value={homeCount}
                    onChange={(event) => setHomeCount(event.target.value)}
                  />
                </label>
              </div>
              <div className="experience-form-row">
                <label>
                  Average home size (carpet sq.ft)
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 500"
                    value={avgHomeSize}
                    onChange={(event) => setAvgHomeSize(event.target.value)}
                  />
                </label>
                <label>
                  Building age (years)
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 32"
                    value={buildingAge}
                    onChange={(event) => setBuildingAge(event.target.value)}
                  />
                </label>
              </div>
              {error && (
                <p className="experience-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="experience-button">
                Next: scheme &amp; rates
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {step === 2 && (
            <form
              className="experience-tentative-card"
              onSubmit={handleStep2Submit}
            >
              <h2>Scheme &amp; rates</h2>
              <p>
                Which regulation do you think applies to your building? If
                you are not sure, say so — establishing that is the first
                thing the detailed study does.
              </p>
              <div
                className="experience-dcpr-grid"
                role="group"
                aria-label="Applicable regulation"
              >
                {SCHEMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="experience-dcpr-card experience-scheme-card"
                    aria-pressed={scheme === item.id}
                    onClick={() => setScheme(item.id)}
                  >
                    <h3>
                      Regulation {item.code} — {item.name}
                    </h3>
                    <p>{item.detail}</p>
                  </button>
                ))}
              </div>
              <label>
                Approx. sale rate in your locality (₹ / sq.ft) — optional
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 22000"
                  value={localityRate}
                  onChange={(event) => setLocalityRate(event.target.value)}
                />
              </label>
              <p>
                How much extra area would members like in their new homes,
                compared with what they have today?
              </p>
              <div
                className="experience-dcpr-grid"
                role="group"
                aria-label="Extra area for members"
              >
                {EXTRA_AREA_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className="experience-dcpr-card experience-scheme-card"
                    aria-pressed={extraArea === item.value}
                    onClick={() => setExtraArea(item.value)}
                  >
                    <h3>{item.label}</h3>
                  </button>
                ))}
              </div>
              {error && (
                <p className="experience-error" role="alert">
                  {error}
                </p>
              )}
              <div className="experience-form-row">
                <button
                  type="button"
                  className="experience-button"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft size={16} />
                  Back to your building
                </button>
                <button type="submit" className="experience-button">
                  See tentative outlook
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {step === 3 && result && (
            <div
              className={`experience-tentative-result experience-tentative-result--${result.band}`}
            >
              <ClipboardCheck size={26} />
              <span className="experience-eyebrow">Tentative indication</span>
              <h3>{result.bandLabel}</h3>
              <ul>
                {result.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <h4>What your choices add</h4>
              <ul>
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <p className="experience-tentative-disclaimer">
                {TENTATIVE_FEASIBILITY_DISCLAIMER}
              </p>
              <Link
                className="experience-button"
                href="/societies/documents"
              >
                Next: prepare your feasibility documents
                <ArrowRight size={16} />
              </Link>
              <p className="experience-step-note">
                No documents are asked for yet — the check above is free and
                takes under a minute. The documents come next, and the
                enquiry only at the end, when you feel ready.
              </p>
              <p className="experience-step-note">
                <button type="button" onClick={handleStartAgain}>
                  Start again with different details →
                </button>
              </p>
            </div>
          )}
        </section>
      </main>
      <ExperienceFooter />
    </div>
  );
}
