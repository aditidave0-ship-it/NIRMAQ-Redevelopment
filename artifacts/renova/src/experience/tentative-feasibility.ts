/**
 * Tentative feasibility screening for the public /societies page.
 *
 * This is a qualitative screening model only. It scores the facts a
 * visitor enters about their own building and returns an indication
 * band. It must never produce rupee figures, FSI/TDR numbers, area
 * entitlements or return estimates — a detailed study by the NIRMAQ
 * team is the only route to real numbers (repo AGENTS.md rule:
 * feasibility must not fabricate conclusions).
 */

export type TentativeFeasibilityInput = {
  plotAreaSqft: number;
  homeCount: number;
  avgHomeCarpetSqft: number;
  buildingAgeYears: number;
  /** Optional. Null/undefined/0 means the visitor did not enter it. */
  localityRatePerSqft?: number | null;
};

export type TentativeBand = "favourable" | "moderate" | "challenging";

export type TentativeFeasibilityResult = {
  band: TentativeBand;
  bandLabel: string;
  score: number;
  maxScore: number;
  share: number;
  reasons: string[];
};

const BAND_LABELS: Record<TentativeBand, string> = {
  favourable: "Favourable — a detailed feasibility study looks worthwhile",
  moderate: "Moderate — worth a detailed study to confirm",
  challenging: "Challenging — a detailed study will show whether it can work",
};

function factorScore(value: number, midThreshold: number, highThreshold: number): number {
  if (value >= highThreshold) return 2;
  if (value >= midThreshold) return 1;
  return 0;
}

export function assessTentativeFeasibility(
  input: TentativeFeasibilityInput,
): TentativeFeasibilityResult {
  const plotScore = factorScore(input.plotAreaSqft, 10_000, 20_000);
  const ageScore = factorScore(input.buildingAgeYears, 20, 30);

  const hasRate =
    input.localityRatePerSqft != null && input.localityRatePerSqft > 0;
  const rateScore = hasRate
    ? factorScore(input.localityRatePerSqft as number, 15_000, 25_000)
    : 0;
  const maxScore = hasRate ? 6 : 4;

  // Density sanity adjustment: how much built-up home area already sits
  // on the plot. A very dense existing layout leaves less headroom.
  const existingHomeArea = input.homeCount * input.avgHomeCarpetSqft;
  const densityRatio =
    input.plotAreaSqft > 0 ? existingHomeArea / input.plotAreaSqft : 0;
  const densityAdjustment = densityRatio <= 0.8 ? 1 : densityRatio > 1.6 ? -1 : 0;

  const rawScore = plotScore + ageScore + rateScore + densityAdjustment;
  const score = Math.max(0, Math.min(maxScore, rawScore));
  const share = maxScore > 0 ? score / maxScore : 0;
  const band: TentativeBand =
    share >= 0.66 ? "favourable" : share >= 0.34 ? "moderate" : "challenging";

  const reasons: string[] = [];
  reasons.push(
    plotScore === 2
      ? "Your plot is on the larger side, which generally gives a redevelopment project more room to work with."
      : plotScore === 1
        ? "Your plot is a moderate size — workable for redevelopment, with less room to spare than a large plot."
        : "Your plot is relatively small, which can make redevelopment economics tighter.",
  );
  reasons.push(
    ageScore === 2
      ? "Your building's age works in your favour — older buildings usually have the clearest case for redevelopment."
      : ageScore === 1
        ? "Your building is at an age where redevelopment starts becoming a serious consideration."
        : "Your building is comparatively young, which can weaken the urgency and economics of redeveloping now.",
  );
  if (hasRate) {
    reasons.push(
      rateScore === 2
        ? "Sale rates in your locality look strong, which supports the economics of a new project."
        : rateScore === 1
          ? "Sale rates in your locality are moderate — the detailed numbers will matter."
          : "Sale rates in your locality look soft, which makes the economics harder to balance.",
    );
  } else {
    reasons.push(
      "You did not enter a locality sale rate, so this indication rests on your plot and building alone — a detailed study would factor local rates in.",
    );
  }

  return {
    band,
    bandLabel: BAND_LABELS[band],
    score,
    maxScore,
    share,
    reasons,
  };
}

export const TENTATIVE_FEASIBILITY_DISCLAIMER =
  "Tentative indication only, based on the details you entered. It is not a feasibility report, valuation, or promise of area, FSI, or returns. A detailed study by the NIRMAQ team is required to assess any project.";
