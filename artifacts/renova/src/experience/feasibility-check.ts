/**
 * Public teaser feasibility check (/feasibility-check).
 *
 * The teaser is a 3-step wizard built from the uploaded NIRMAQ.IN engine's
 * shape — building first, then scheme & rates, then the outlook — but the
 * outlook itself comes only from the reviewed public scorer in
 * ./tentative-feasibility (assessTentativeFeasibility). Nothing here
 * computes money, areas, FSI/TDR or returns.
 *
 * What Step 2 adds is context, not scoring: the scheme the visitor picks
 * and the extra area members would like only change the plain-language
 * notes below the band. They never move the band, and no note ever
 * contains a rupee figure, an area, or an FSI number — the detailed study
 * by the NIRMAQ team is the only route to real numbers (repo AGENTS.md:
 * do not fabricate FSI, TDR, costs, returns or regulatory conclusions).
 */

export type TeaserScheme = "33_7_B" | "33_11" | "not_sure";

/** Extra carpet area members would like, as a percentage of existing carpet. 30 means "30% or more". */
export type ExtraAreaChoice = 0 | 10 | 20 | 30;

const SCHEME_NOTES: Record<TeaserScheme, string> = {
  "33_7_B":
    "You picked Regulation 33(7)(B) — the clause most suburban housing societies over 30 years old redevelop under. Which regulation actually applies to your building is confirmed in the detailed study; it shapes what a developer can offer.",
  "33_11":
    "You picked Regulation 33(11) — the SRA clubbing route. Whether it is open to your building, and what the clubbing cost would be, is confirmed in the detailed study.",
  not_sure:
    "You are not sure which regulation applies — that is exactly what the detailed study establishes first, before any numbers are discussed.",
};

const EXTRA_AREA_NOTES: Record<ExtraAreaChoice, string> = {
  0: "You entered no extra area for members. The detailed study can model what different levels of extra area would mean for the project.",
  10: "A modest extra area for members is usually workable — the detailed study models exactly how it affects the project.",
  20: "Extra area of around a fifth more for members is a meaningful ask — the detailed study models the trade-off openly with your committee.",
  30: "A large extra area for members tightens the economics considerably — the detailed study is where that trade-off is worked through honestly, before any promises are made.",
};

/**
 * Plain-language notes for the teaser's result step: one for the scheme
 * the visitor picked, one for the extra area they asked for. Order is
 * fixed (scheme first), and the text never contains figures.
 */
export function getTeaserSensitivityNotes(
  scheme: TeaserScheme,
  extraAreaPct: ExtraAreaChoice,
): string[] {
  return [SCHEME_NOTES[scheme], EXTRA_AREA_NOTES[extraAreaPct]];
}
