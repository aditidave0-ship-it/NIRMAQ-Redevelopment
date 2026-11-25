/**
 * Society Redevelopment Intake Form (/societies/intake-form).
 *
 * The 15-field plain-English intake for a co-operative housing society.
 * This module is pure: validation, mapping onto the existing requirement
 * enquiry pipeline (./requirement-enquiry — no parallel backend), and
 * deriving the tentative-feasibility inputs from the four numbers the
 * form collects (plot area, flat count, total carpet, local selling
 * rate). The band itself comes from the reviewed public scorer.
 *
 * One deliberate correction to the form's closing note: the four numbers
 * generate the tentative *indication band* only. The maximum viable
 * extra area members can be offered is NOT computed here — it is worked
 * out in the detailed study by the NIRMAQ team, with real costs and
 * premiums. Nothing in this module promises an area, an FSI, or a return.
 */

import { assessTentativeFeasibility } from "./tentative-feasibility.ts";
import type {
  TentativeFeasibilityInput,
  TentativeFeasibilityResult,
} from "./tentative-feasibility.ts";
import type { RequirementEnquiryDetails } from "./requirement-enquiry.ts";

export const SQM_TO_SQFT = 10.764;

export type LandOwnership = "freehold" | "leasehold" | "builder_lease" | "";
export type RoadWidth = "under_9" | "9_12" | "12_18" | "18_plus" | "";
export type RoadReservation = "yes" | "no" | "not_sure" | "";
export type ParkingRequirement = "covered" | "stack_ok" | "";
export type PlotUnit = "sqm" | "sqft";

export const LAND_OWNERSHIP_LABELS: Record<
  Exclude<LandOwnership, "">,
  string
> = {
  freehold: "Society Conveyed Freehold",
  leasehold: "Collector / MHADA / Govt. Leasehold",
  builder_lease: "Builder / Developer Lease",
};

export const ROAD_WIDTH_LABELS: Record<Exclude<RoadWidth, "">, string> = {
  under_9: "Less than 9m",
  "9_12": "9m to 12m",
  "12_18": "12m to 18m",
  "18_plus": "18m or wider",
};

export const ROAD_RESERVATION_LABELS: Record<
  Exclude<RoadReservation, "">,
  string
> = {
  yes: "Yes",
  no: "No",
  not_sure: "Not sure (check DP remarks)",
};

export const PARKING_LABELS: Record<Exclude<ParkingRequirement, "">, string> =
  {
    covered: "1 covered parking per flat",
    stack_ok: "Stack parking acceptable",
  };

export const EXTRA_AREA_OPTIONS = ["15", "20", "25", "30"] as const;

export const DOCUMENT_OPTIONS = [
  { id: "property_card", label: "Property Card (P.R. Card)" },
  { id: "conveyance_deed", label: "Conveyance Deed / Lease Deed" },
  { id: "registration_certificate", label: "Society Registration Certificate" },
  {
    id: "oc_plan",
    label: "MCGM Occupation Certificate (OC) & Approved Building Plan",
  },
  { id: "member_area_list", label: "Member Area List (flat-wise carpet area)" },
  { id: "dp_remarks", label: "DP 2034 Remarks" },
] as const;

export type IntakeFormValues = {
  societyName: string;
  registrationNumber: string;
  address: string;
  wardCts: string;
  landOwnership: LandOwnership;
  plotArea: string;
  plotUnit: PlotUnit;
  roadWidth: RoadWidth;
  roadReservation: RoadReservation;
  buildingAge: string;
  structureType: string;
  residentialFlats: string;
  commercialUnits: string;
  totalCarpet: string;
  avgCarpet: string;
  extraAreaPct: string;
  corpusPerSqft: string;
  rentPerSqft: string;
  parking: ParkingRequirement;
  sellingPrice: string;
  documents: string[];
  contactName: string;
  contactRole: string;
  contactPhone: string;
  contactEmail: string;
  consent: boolean;
};

export const EMPTY_INTAKE_FORM: IntakeFormValues = {
  societyName: "",
  registrationNumber: "",
  address: "",
  wardCts: "",
  landOwnership: "",
  plotArea: "",
  plotUnit: "sqm",
  roadWidth: "",
  roadReservation: "",
  buildingAge: "",
  structureType: "",
  residentialFlats: "",
  commercialUnits: "",
  totalCarpet: "",
  avgCarpet: "",
  extraAreaPct: "",
  corpusPerSqft: "",
  rentPerSqft: "",
  parking: "",
  sellingPrice: "",
  documents: [],
  contactName: "",
  contactRole: "",
  contactPhone: "",
  contactEmail: "",
  consent: false,
};

function parsePositive(value: string): number | null {
  const num = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseNonNegative(value: string): number | null {
  const num = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(num) && num >= 0 ? num : null;
}

export function intakePlotAreaSqft(values: IntakeFormValues): number | null {
  const area = parsePositive(values.plotArea);
  if (area === null) return null;
  return values.plotUnit === "sqm"
    ? Math.round(area * SQM_TO_SQFT)
    : Math.round(area);
}

/** Validation errors for the form, in plain language. Empty means valid. */
export function validateIntakeForm(values: IntakeFormValues): string[] {
  const errors: string[] = [];
  if (!values.societyName.trim())
    errors.push("Please enter the name of your housing society.");
  if (intakePlotAreaSqft(values) === null)
    errors.push("Please enter the total plot area as a number.");
  if (parsePositive(values.residentialFlats) === null)
    errors.push("Please enter the total number of residential flats.");
  if (parsePositive(values.buildingAge) === null)
    errors.push("Please enter the building age in years.");
  if (values.totalCarpet.trim() === "" && values.avgCarpet.trim() === "")
    errors.push(
      "Please enter either the total carpet area of all flats or the average flat carpet area — the team needs one of them for the first indication.",
    );
  if (!values.contactName.trim())
    errors.push("Please enter a committee contact name.");
  if (!values.contactPhone.trim())
    errors.push("Please enter a contact phone number.");
  if (!values.contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim()))
    errors.push("Please enter a valid contact email address.");
  if (!values.consent)
    errors.push(
      "Please tick the consent box so NIRMAQ may contact your society about this enquiry.",
    );
  return errors;
}

function orNotProvided(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? "Not provided" : trimmed;
}

function moneyLine(label: string, value: string, unit: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : `${label}: ₹${trimmed} ${unit}`;
}

/**
 * Maps the intake form onto the existing requirement enquiry payload.
 * Everything the pipeline does not have a field for travels in the
 * brief as structured plain text — no field is dropped silently.
 */
export function buildIntakeEnquiryDetails(
  values: IntakeFormValues,
): RequirementEnquiryDetails {
  const plotSqft = intakePlotAreaSqft(values);
  const flats = parsePositive(values.residentialFlats);
  const commercial = parseNonNegative(values.commercialUnits);
  const totalCarpet = parsePositive(values.totalCarpet);
  const avgCarpet = parsePositive(values.avgCarpet);
  const age = parsePositive(values.buildingAge);

  const briefLines: string[] = ["Society redevelopment intake form"];
  briefLines.push(
    `Registration number & year: ${orNotProvided(values.registrationNumber)}`,
  );
  briefLines.push(
    `Municipal ward & village / CTS No.: ${orNotProvided(values.wardCts)}`,
  );
  if (plotSqft !== null) {
    const entered =
      values.plotUnit === "sqm"
        ? `${values.plotArea.trim()} Sq. Mtrs`
        : `${values.plotArea.trim()} Sq. Ft.`;
    briefLines.push(
      `Plot area: ${entered} (${Math.round(plotSqft).toLocaleString("en-IN")} Sq. Ft.)`,
    );
  }
  if (values.roadWidth !== "")
    briefLines.push(
      `Width of road touching the plot: ${ROAD_WIDTH_LABELS[values.roadWidth]}`,
    );
  if (values.roadReservation !== "")
    briefLines.push(
      `Road widening / reservation on plot: ${ROAD_RESERVATION_LABELS[values.roadReservation]}`,
    );
  if (values.structureType.trim() !== "")
    briefLines.push(`Structure type: ${values.structureType.trim()}`);
  if (commercial !== null)
    briefLines.push(`Commercial shops / offices: ${commercial}`);
  if (totalCarpet !== null)
    briefLines.push(
      `Total existing carpet area of all flats: ${totalCarpet.toLocaleString("en-IN")} Sq. Ft.`,
    );
  if (avgCarpet !== null)
    briefLines.push(
      `Average flat carpet area: ${avgCarpet.toLocaleString("en-IN")} Sq. Ft.`,
    );
  if (values.extraAreaPct !== "")
    briefLines.push(
      `Expected extra carpet area: ${values.extraAreaPct}%${values.extraAreaPct === "30" ? " or more" : ""}`,
    );
  const corpus = moneyLine(
    "Expected hardship corpus",
    values.corpusPerSqft,
    "per sq. ft.",
  );
  if (corpus) briefLines.push(corpus);
  const rent = moneyLine(
    "Current local rent in area",
    values.rentPerSqft,
    "per sq. ft. per month",
  );
  if (rent) briefLines.push(rent);
  if (values.parking !== "")
    briefLines.push(
      `Car parking requirement: ${PARKING_LABELS[values.parking]}`,
    );
  const price = moneyLine(
    "Expected new flat selling price in area",
    values.sellingPrice,
    "per sq. ft.",
  );
  if (price) briefLines.push(price);
  const readyDocs = DOCUMENT_OPTIONS.filter((doc) =>
    values.documents.includes(doc.id),
  ).map((doc) => doc.label);
  briefLines.push(
    readyDocs.length > 0
      ? `Documents ready: ${readyDocs.join("; ")}`
      : "Documents ready: none ticked yet",
  );

  return {
    societyName: values.societyName.trim(),
    location: [values.address.trim(), values.wardCts.trim()]
      .filter((part) => part !== "")
      .join(" · "),
    societyType: "Co-operative Housing Society",
    memberCount: flats ?? 0,
    buildingAge: age ?? 0,
    landType:
      values.landOwnership === ""
        ? undefined
        : LAND_OWNERSHIP_LABELS[values.landOwnership],
    plotArea: plotSqft === null ? undefined : Math.round(plotSqft),
    conveyanceStatus: values.documents.includes("conveyance_deed")
      ? "Conveyance Deed available"
      : "Conveyance Deed not yet available",
    structuralAudit: undefined,
    services: ["Feasibility review"],
    timeline: "Not specified",
    brief: briefLines.join("\n"),
    contactName: values.contactName.trim(),
    contactRole: values.contactRole.trim() || "Committee member",
    phone: values.contactPhone.trim(),
    email: values.contactEmail.trim(),
    consent: values.consent,
  };
}

/**
 * The four numbers the form collects, as tentative-feasibility inputs.
 * Returns null when the band cannot be computed (missing plot, flats,
 * age, or both carpet figures) — the caller then shows no band rather
 * than a made-up one.
 */
export function intakeBandInput(
  values: IntakeFormValues,
): TentativeFeasibilityInput | null {
  const plotAreaSqft = intakePlotAreaSqft(values);
  const homes = parsePositive(values.residentialFlats);
  const age = parsePositive(values.buildingAge);
  const totalCarpet = parsePositive(values.totalCarpet);
  const avgCarpet = parsePositive(values.avgCarpet);
  const avgHomeCarpetSqft =
    totalCarpet !== null && homes !== null
      ? totalCarpet / homes
      : avgCarpet;
  if (
    plotAreaSqft === null ||
    homes === null ||
    age === null ||
    avgHomeCarpetSqft === null
  )
    return null;
  const rate = parsePositive(values.sellingPrice);
  return {
    plotAreaSqft,
    homeCount: homes,
    avgHomeCarpetSqft,
    buildingAgeYears: age,
    localityRatePerSqft: rate,
  };
}

export function assessIntakeBand(
  values: IntakeFormValues,
): TentativeFeasibilityResult | null {
  const input = intakeBandInput(values);
  return input === null ? null : assessTentativeFeasibility(input);
}
