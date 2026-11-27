/**
 * Feasibility documents dashboard (/societies/documents).
 *
 * The eight documents and details NIRMAQ needs from a housing society
 * before feasibility preparation can start — Aditi's list, 25 Nov 2026,
 * in her words, with her compulsory marks. Six of the eight are
 * compulsory; the DP remark and the conveyance are not marked compulsory.
 *
 * The dashboard has two views of the same checklist: the society gives
 * (their own view — upload a file where there is a document, type the
 * detail where it is a number or a link) and the NIRMAQ team tracks
 * (team view — the team marks each item verified as it is checked).
 *
 * How each item is given — Aditi's decision, 25 Nov 2026: a mix. Files
 * for documents (DP remark, property card, conveyance, member list);
 * details for numbers and links (CTS number typed in, Google Maps link
 * pasted, commercial/residential split and carpet areas as figures).
 *
 * Honesty rules for this page:
 * - The working checklist is saved on the visitor's own device only
 *   (localStorage) while they prepare it. Nothing here claims the
 *   documents have reached NIRMAQ.
 * - The handover goes through the existing requirement enquiry pipeline
 *   (./requirement-enquiry — no parallel backend): the checklist, with
 *   the file names chosen and the details typed in, is sent as an
 *   enquiry. The files themselves are emailed to info@nirmaq.in by the
 *   society — the brief says so plainly, and the page says so too.
 *   A failed save shows an honest error with the email fallback, never
 *   fake success (same rule as the intake form).
 * - Nothing here promises an area, an FSI, or a return. The maximum
 *   viable extra area is worked out in the detailed study, never
 *   computed by this page.
 */

import type { RequirementEnquiryDetails } from "./requirement-enquiry.ts";

export type DocumentKind =
  | "link"
  | "text"
  | "file"
  | "bifurcation"
  | "carpet_table";

export type DocumentId =
  | "google_location"
  | "cts_number"
  | "dp_remark"
  | "property_card"
  | "conveyance"
  | "member_list"
  | "bifurcation"
  | "carpet_areas";

export type DocumentItem = {
  id: DocumentId;
  title: string;
  compulsory: boolean;
  kind: DocumentKind;
  help: string;
  placeholder?: string;
};

export const DOCUMENT_ITEMS: DocumentItem[] = [
  {
    id: "google_location",
    title: "Google location",
    compulsory: true,
    kind: "link",
    help: "Paste the Google Maps link for your plot — open Google Maps, find your building, Share, then Copy link.",
    placeholder: "e.g. https://maps.app.goo.gl/…",
  },
  {
    id: "cts_number",
    title: "CTS number",
    compulsory: true,
    kind: "text",
    help: "The City Survey (CTS) number of your plot — it is on your property card or 7/12 extract.",
    placeholder: "e.g. CTS 1234",
  },
  {
    id: "dp_remark",
    title: "DP remark",
    compulsory: false,
    kind: "file",
    help: "The Development Plan remark for your plot — the land use, zone and reservations that apply to it.",
  },
  {
    id: "property_card",
    title: "Property card",
    compulsory: true,
    kind: "file",
    help: "The property card (P.R. card) extract for your plot.",
  },
  {
    id: "conveyance",
    title: "Conveyance",
    compulsory: false,
    kind: "file",
    help: "The conveyance deed, if the land is conveyed to the society. If it is not conveyed yet, send what you have — the team will advise on the rest.",
  },
  {
    id: "member_list",
    title: "List of existing members",
    compulsory: true,
    kind: "file",
    help: "The society's member list — every member household, residential and commercial.",
  },
  {
    id: "bifurcation",
    title: "Bifurcation of commercial and residential members",
    compulsory: true,
    kind: "bifurcation",
    help: "How many members are residential homes and how many are commercial (shops and offices).",
  },
  {
    id: "carpet_areas",
    title: "Existing carpet area used by member",
    compulsory: true,
    kind: "carpet_table",
    help: "Each member's existing carpet area, flat by flat. Add one row per flat — the total is added up for you.",
  },
];

export type CarpetRow = {
  id: string;
  label: string;
  area: string;
};

export type DocumentAnswers = {
  google_location: string;
  cts_number: string;
  dp_remark: string;
  property_card: string;
  conveyance: string;
  member_list: string;
  bifurcation: { residential: string; commercial: string };
  carpet_areas: CarpetRow[];
  /** Compulsory remarks the society writes at the end, before sending: a specific regulation or percentage they want, or anything else. */
  remarks: string;
};

export const EMPTY_DOCUMENT_ANSWERS: DocumentAnswers = {
  google_location: "",
  cts_number: "",
  dp_remark: "",
  property_card: "",
  conveyance: "",
  member_list: "",
  bifurcation: { residential: "", commercial: "" },
  carpet_areas: [],
  remarks: "",
};

/** The NIRMAQ team's verdict on one item: not yet checked, verified, or sent back. */
export type TeamItemStatus = "awaiting" | "verified" | "needs_again";

export type TeamStatuses = Record<DocumentId, TeamItemStatus>;

export const EMPTY_TEAM_STATUSES: TeamStatuses = {
  google_location: "awaiting",
  cts_number: "awaiting",
  dp_remark: "awaiting",
  property_card: "awaiting",
  conveyance: "awaiting",
  member_list: "awaiting",
  bifurcation: "awaiting",
  carpet_areas: "awaiting",
};

export const TEAM_STATUS_LABELS: Record<TeamItemStatus, string> = {
  awaiting: "Awaiting check",
  verified: "Verified by NIRMAQ team",
  needs_again: "Needs another copy",
};

function parseNonNegative(value: string): number | null {
  const num = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function parsePositive(value: string): number | null {
  const num = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(num) && num > 0 ? num : null;
}

/** Loose check that a pasted link looks like a Google Maps link. Drives a warning note only — it never blocks. */
export function isMapsLink(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v.startsWith("http") &&
    (v.includes("google.") || v.includes("goo.gl") || v.includes("maps"))
  );
}

export function bifurcationTotal(answers: DocumentAnswers): number | null {
  const residential = parseNonNegative(answers.bifurcation.residential);
  const commercial = parseNonNegative(answers.bifurcation.commercial);
  if (residential === null || commercial === null) return null;
  return residential + commercial;
}

export function carpetTotalSqft(answers: DocumentAnswers): number {
  return answers.carpet_areas.reduce((sum, row) => {
    const area = parsePositive(row.area);
    return area === null ? sum : sum + area;
  }, 0);
}

export function carpetRowsGiven(answers: DocumentAnswers): number {
  return answers.carpet_areas.filter(
    (row) => parsePositive(row.area) !== null,
  ).length;
}

/** Whether the society has given this item, in the form the item asks for. */
export function isItemGiven(
  item: DocumentItem,
  answers: DocumentAnswers,
): boolean {
  switch (item.id) {
    case "google_location":
      return answers.google_location.trim() !== "";
    case "cts_number":
      return answers.cts_number.trim() !== "";
    case "dp_remark":
      return answers.dp_remark.trim() !== "";
    case "property_card":
      return answers.property_card.trim() !== "";
    case "conveyance":
      return answers.conveyance.trim() !== "";
    case "member_list":
      return answers.member_list.trim() !== "";
    case "bifurcation": {
      const total = bifurcationTotal(answers);
      return total !== null && total > 0;
    }
    case "carpet_areas":
      return carpetRowsGiven(answers) > 0;
  }
}

export type DocumentsReadiness = {
  compulsoryGiven: number;
  compulsoryTotal: number;
  totalGiven: number;
  total: number;
  ready: boolean;
  missingCompulsory: DocumentItem[];
  missingAll: DocumentItem[];
};

/** Readiness for feasibility preparation: all six compulsory items given. */
export function documentsReadiness(
  answers: DocumentAnswers,
): DocumentsReadiness {
  const given = DOCUMENT_ITEMS.filter((item) => isItemGiven(item, answers));
  const compulsory = DOCUMENT_ITEMS.filter((item) => item.compulsory);
  const missingCompulsory = compulsory.filter(
    (item) => !isItemGiven(item, answers),
  );
  return {
    compulsoryGiven: compulsory.length - missingCompulsory.length,
    compulsoryTotal: compulsory.length,
    totalGiven: given.length,
    total: DOCUMENT_ITEMS.length,
    ready: missingCompulsory.length === 0,
    missingCompulsory,
    missingAll: DOCUMENT_ITEMS.filter((item) => !isItemGiven(item, answers)),
  };
}

export type TeamReadiness = {
  verifiedCompulsory: number;
  compulsoryTotal: number;
  blocking: DocumentItem[];
};

/** The team's view of the same checklist: compulsory items verified so far, and what still blocks the detailed study. */
export function teamReadiness(
  answers: DocumentAnswers,
  teamStatuses: TeamStatuses,
): TeamReadiness {
  const compulsory = DOCUMENT_ITEMS.filter((item) => item.compulsory);
  const blocking = compulsory.filter(
    (item) => !(isItemGiven(item, answers) && teamStatuses[item.id] === "verified"),
  );
  return {
    verifiedCompulsory: compulsory.length - blocking.length,
    compulsoryTotal: compulsory.length,
    blocking,
  };
}

export type DocumentsContact = {
  name: string;
  role: string;
  phone: string;
  email: string;
  consent: boolean;
};

export const EMPTY_DOCUMENTS_CONTACT: DocumentsContact = {
  name: "",
  role: "",
  phone: "",
  email: "",
  consent: false,
};

/** Validation errors for sending the checklist, in plain language. Empty means it can be sent. */
export function validateDocumentsSend(
  societyName: string,
  contact: DocumentsContact,
  answers: DocumentAnswers,
): string[] {
  const errors: string[] = [];
  if (!societyName.trim())
    errors.push("Please enter the name of your housing society.");
  if (documentsReadiness(answers).totalGiven === 0)
    errors.push(
      "Please give at least one document or detail before sending — the checklist is empty.",
    );
  if (!answers.remarks.trim())
    errors.push(
      "Please write your remarks — tell us anything specific, like a regulation you want or the extra area percentage you have in mind.",
    );
  if (!contact.name.trim())
    errors.push("Please enter a committee contact name.");
  if (!contact.phone.trim())
    errors.push("Please enter a contact phone number.");
  if (
    !contact.email.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())
  )
    errors.push("Please enter a valid contact email address.");
  if (!contact.consent)
    errors.push(
      "Please tick the consent box so NIRMAQ may contact your society about this enquiry.",
    );
  return errors;
}

function orNotGiven(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? "Not given yet" : trimmed;
}

function fileLine(label: string, fileName: string): string {
  const name = fileName.trim();
  return name === ""
    ? `${label}: not given yet`
    : `${label}: file chosen — ${name} (send the file itself by email to info@nirmaq.in)`;
}

/**
 * Maps the dashboard checklist onto the existing requirement enquiry
 * payload. Everything the pipeline does not have a field for travels in
 * the brief as structured plain text — no item is dropped silently. The
 * file names chosen are listed; the files themselves are emailed by the
 * society, and the brief says so.
 */
export function buildDocumentsEnquiryDetails(
  societyName: string,
  contact: DocumentsContact,
  answers: DocumentAnswers,
): RequirementEnquiryDetails {
  const readiness = documentsReadiness(answers);
  const memberCount = bifurcationTotal(answers);
  const carpetTotal = carpetTotalSqft(answers);
  const rowsGiven = carpetRowsGiven(answers);

  const briefLines: string[] = [
    "Feasibility documents checklist — sent from the society documents dashboard",
  ];
  briefLines.push(
    `Google location: ${orNotGiven(answers.google_location)}`,
  );
  briefLines.push(`CTS number: ${orNotGiven(answers.cts_number)}`);
  briefLines.push(fileLine("DP remark", answers.dp_remark));
  briefLines.push(fileLine("Property card", answers.property_card));
  briefLines.push(fileLine("Conveyance", answers.conveyance));
  briefLines.push(fileLine("List of existing members", answers.member_list));
  if (memberCount !== null) {
    briefLines.push(
      `Bifurcation of commercial and residential members: ${answers.bifurcation.residential.trim()} residential, ${answers.bifurcation.commercial.trim()} commercial (${memberCount} members in total)`,
    );
  } else {
    briefLines.push(
      "Bifurcation of commercial and residential members: not given yet",
    );
  }
  if (rowsGiven > 0) {
    briefLines.push(
      `Existing carpet area, member by member: ${rowsGiven} flat${rowsGiven === 1 ? "" : "s"} listed, total ${carpetTotal.toLocaleString("en-IN")} sq.ft`,
    );
    const listed = answers.carpet_areas
      .filter((row) => parsePositive(row.area) !== null)
      .slice(0, 10);
    for (const row of listed) {
      const area = parsePositive(row.area);
      briefLines.push(
        `  - ${row.label.trim() === "" ? "Flat" : row.label.trim()}: ${area === null ? row.area.trim() : area.toLocaleString("en-IN")} sq.ft`,
      );
    }
    if (rowsGiven > 10)
      briefLines.push(`  - …and ${rowsGiven - 10} more flats listed`);
  } else {
    briefLines.push(
      "Existing carpet area, member by member: not given yet",
    );
  }
  briefLines.push(
    `Society's remarks: ${answers.remarks.trim()}`,
  );
  briefLines.push(
    readiness.missingCompulsory.length === 0
      ? "All six compulsory items are given — ready for feasibility preparation."
      : `Still needed before feasibility preparation: ${readiness.missingCompulsory.map((item) => item.title).join("; ")}`,
  );
  briefLines.push(
    "Documents to send by email: the files listed above are to be attached to an email to info@nirmaq.in — the checklist alone does not carry the files.",
  );

  return {
    societyName: societyName.trim(),
    location: "Not provided on this checklist",
    societyType: "Co-operative Housing Society",
    memberCount: memberCount ?? 0,
    buildingAge: 0,
    landType: undefined,
    plotArea: undefined,
    conveyanceStatus:
      answers.conveyance.trim() === ""
        ? "Conveyance document not given yet"
        : "Conveyance document chosen — file to follow by email",
    structuralAudit: undefined,
    services: ["Feasibility review"],
    timeline: "Not specified",
    brief: briefLines.join("\n"),
    contactName: contact.name.trim(),
    contactRole: contact.role.trim() || "Committee member",
    phone: contact.phone.trim(),
    email: contact.email.trim(),
    consent: contact.consent,
  };
}
