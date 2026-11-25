import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "wouter";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import {
  assessTentativeFeasibility,
  TENTATIVE_FEASIBILITY_DISCLAIMER,
} from "./tentative-feasibility";
import type { TentativeFeasibilityResult } from "./tentative-feasibility";

/**
 * Public tentative feasibility check for /societies.
 *
 * Qualitative screening only: the visitor enters facts about their own
 * building and sees an indication band with plain-language reasons.
 * Nothing is submitted, stored or sent anywhere — all state is local —
 * and the result carries no figures, entitlements or promises. The
 * full assessment is a NIRMAQ team workflow (internal simulator).
 */
export function TentativeFeasibility() {
  const [plotArea, setPlotArea] = useState("");
  const [homeCount, setHomeCount] = useState("");
  const [avgHomeSize, setAvgHomeSize] = useState("");
  const [buildingAge, setBuildingAge] = useState("");
  const [localityRate, setLocalityRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TentativeFeasibilityResult | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const plot = Number.parseFloat(plotArea);
    const homes = Number.parseFloat(homeCount);
    const avgSize = Number.parseFloat(avgHomeSize);
    const age = Number.parseFloat(buildingAge);
    const rate = Number.parseFloat(localityRate);
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
      setResult(null);
      return;
    }
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
  }

  return (
    <section className="experience-tentative" aria-label="Tentative feasibility check">
      <span className="experience-eyebrow">Tentative feasibility check</span>
      <h2>A tentative first look at your building&rsquo;s potential</h2>
      <p className="experience-tentative-intro">
        Answer five short questions about your building and see a tentative
        indication of whether a detailed redevelopment feasibility study is
        worth your committee&rsquo;s time. This is a first look only — the
        detailed study is done by the NIRMAQ team. Prefer to go step by
        step — building, then scheme and rates?{" "}
        <Link href="/feasibility-check">
          Try the 3-step feasibility check →
        </Link>
      </p>
      <form className="experience-tentative-card" onSubmit={handleSubmit}>
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
        {error && (
          <p className="experience-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="experience-button">
          See tentative indication
          <ArrowRight size={16} />
        </button>
      </form>
      {result && (
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
          <p className="experience-tentative-disclaimer">
            {TENTATIVE_FEASIBILITY_DISCLAIMER}
          </p>
          <Link
            className="experience-button"
            href="/contact?subject=Society%20feasibility"
          >
            Request a full feasibility assessment
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </section>
  );
}
