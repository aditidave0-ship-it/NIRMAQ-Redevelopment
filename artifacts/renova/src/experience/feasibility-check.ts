/**
 * Public teaser feasibility check (/feasibility-check).
 *
 * The teaser is a 3-step wizard built from the uploaded NIRMAQ.IN engine's
 * shape — building first, then rates and extra area, then the outlook —
 * but the outlook itself comes only from the reviewed public scorer in
 * ./tentative-feasibility (assessTentativeFeasibility). Nothing here
 * computes money, areas, FSI/TDR or returns.
 *
 * The society does NOT pick a regulation here (Aditi's decision,
 * 26 Nov 2026): which regulation applies is for the NIRMAQ team to
 * establish in the detailed study. If the society wants a specific
 * regulation, they say so in the remarks on the documents page
 * (/societies/documents), which is compulsory there.
 *
 * What Step 2 adds is context, not scoring: the extra area members
 * would like only changes the plain-language note below the band. It
 * never moves the band, and no note ever contains a rupee figure, an
 * area, or an FSI number — the detailed study by the NIRMAQ team is
 * the only route to real numbers (repo AGENTS.md: do not fabricate
 * FSI, TDR, costs, returns or regulatory conclusions).
 */

/** Extra carpet area members would like, as a percentage of existing carpet. 30 means "30% or more". */
export type ExtraAreaChoice = 0 | 10 | 20 | 30;

const EXTRA_AREA_NOTES: Record<ExtraAreaChoice, string> = {
  0: "You entered no extra area for members. The detailed study can model what different levels of extra area would mean for the project.",
  10: "A modest extra area for members is usually workable — the detailed study models exactly how it affects the project.",
  20: "Extra area of around a fifth more for members is a meaningful ask — the detailed study models the trade-off openly with your committee.",
  30: "A large extra area for members tightens the economics considerably — the detailed study is where that trade-off is worked through honestly, before any promises are made.",
};

/**
 * Plain-language note for the teaser's result step: the extra area the
 * visitor asked for. The text never contains figures.
 */
export function getTeaserSensitivityNotes(
  extraAreaPct: ExtraAreaChoice,
): string[] {
  return [EXTRA_AREA_NOTES[extraAreaPct]];
}
