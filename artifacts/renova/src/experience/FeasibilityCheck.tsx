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
import type { ExtraAreaChoice } from "./feasibility-check";

/**
 * Public teaser feasibility check (/feasibility-check).
 *
 * A 3-step wizard in the uploaded NIRMAQ.IN engine's shape — your
 * building, then rates and extra area, then the outlook — but the
 * outlook itself is only the reviewed public scorer
 * (assessTentativeFeasibility): a qualitative band with plain-language
 * reasons, no rupee figures, no areas, no FSI/TDR numbers, no return
 * estimates. Step 2 only adds a plain-language note about the extra
 * area the visitor asked for; it never moves the band. The society
 * does not pick a regulation here — which regulation applies is for
 * the NIRMAQ team to establish in the detailed study, and the society
 * says what it wants in the compulsory remarks on the documents page.
 * Nothing is submitted, stored or sent anywhere — all state is local.
 * The full assessment, with real numbers, is a NIRMAQ team workflow.
 */

type TeaserStep = 1 | 2 | 3;

const EXTRA_AREA_OPTIONS: Array<{ value: ExtraAreaChoice; label: string }> = [
  { value: 0, label: "None" },
  { value: 10, label: "About 10% more" },
  { value: 20, label: "About 20% more" },
  { value: 30, label: "30% or more" },
];

const STEP_LABELS: Record<TeaserStep, string> = {
  1: "Step 1 of 3 — Your building",
  2: "Step 2 of 3 — Rates & extra area",
  3: "Step 3 of 3 — Your tentative outlook",
};

export function FeasibilityCheckPage() {
  const [step, setStep] = useState<TeaserStep>(1);
  const [plotArea, setPlotArea] = useState("");
  const [homeCount, setHomeCount] = useState("");
  const [avgHomeSize, setAvgHomeSize] = useState("");
  const [buildingAge, setBuildingAge] = useState("");
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
    setResult(
      assessTentativeFeasibility({
        plotAreaSqft: plot,
        homeCount: homes,
        avgHomeCarpetSqft: avgSize,
        buildingAgeYears: age,
        localityRatePerSqft: Number.isFinite(rate) && rate > 0 ? rate : null,
      }),
    );
    setStep(3);
  }

  function handleStartAgain() {
    setStep(1);
    setPlotArea("");
    setHomeCount("");
    setAvgHomeSize("");
    setBuildingAge("");
    setLocalityRate("");
    setExtraArea(0);
    setError(null);
    setResult(null);
  }

  const notes = getTeaserSensitivityNotes(extraArea);

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
          Three short steps — your building, then the rates and extra
          area, then your tentative outlook. This is a first look only: it
          shows an indication, not figures, and never an area, entitlement
          or return. The detailed study, with real numbers, is done by the
          NIRMAQ team.
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
                Next: rates &amp; extra area
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {step === 2 && (
            <form
              className="experience-tentative-card"
              onSubmit={handleStep2Submit}
            >
              <h2>Rates &amp; extra area</h2>
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
                    className="experience-dcpr-card experience-option-card"
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
