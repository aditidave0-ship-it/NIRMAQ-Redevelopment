/**
 * Feasibility Dashboard (/feasibility-dashboard).
 *
 * The society contact-person dashboard Aditi sent as a standalone file
 * (27 Nov 2026), now as a page on the site — same format, in the
 * approved no-box "Society File" look. Four sections, in the file's
 * order: 1. Basic Details, 2. Feasibility & Property Documents,
 * 3. Number of Members & Carpet Area Utilized, 4. Additional
 * Information.
 *
 * The society fills it in here. The NIRMAQ team sees the record
 * through the enquiry, at info@nirmaq.in — there is no team view on
 * this page (Aditi, 27 Nov 2026).
 *
 * Honesty rules for this page (same as the documents dashboard):
 * - The working record is saved on the visitor's own device only
 *   (localStorage) while they prepare it. Nothing here claims the
 *   record has reached NIRMAQ.
 * - The handover goes through the existing requirement enquiry
 *   pipeline (./requirement-enquiry — no parallel backend): the
 *   record travels in the enquiry as structured text. The files
 *   themselves are emailed to info@nirmaq.in by the society — only
 *   the file names chosen travel in the enquiry, and the page and
 *   the brief say so plainly. A failed send shows an honest error
 *   with the email fallback, never fake success.
 * - Nothing here promises an area, an FSI, or a return. The maximum
 *   viable extra area is worked out in the detailed study, never
 *   computed by this page. The totals shown are the society's own
 *   figures added up — members and carpet area, nothing more.
 */

import type { RequirementEnquiryDetails } from "./requirement-enquiry.ts";

export const DISTRICT_OPTIONS = ["Mumbai City", "Mumbai Sub"] as const;
export const TALUKA_OPTIONS = [
  "Mumbai City",
  "Andheri",
  "Borivali",
  "Kurla",
] as const;
export const PROPERTY_CARD_OPTIONS = [
  "Available",
  "Not Available",
  "Pending",
] as const;
export const ROAD_WIDTH_OPTIONS = [
  "6.10 M",
  "9.15 M",
  "12.20 M",
  "13.40 M",
  "18.3 M",
  "27.45 M",
  "36.6 M",
  "Other / To be confirmed",
] as const;

export type DashboardAnswers = {
  /** 1. Basic Details — the society's contact person. */
  contactPerson: string;
  societyName: string;
  ctsNumber: string;
  district: string;
  taluka: string;
  village: string;
  address: string;
  googleLocation: string;
  /** 2. Feasibility & Property Documents. */
  ctsRecord: string;
  propertyCard: string;
  conveyanceFiles: string[];
  dpRemarkFiles: string[];
  plotAreaSqm: string;
  roadWidth: string;
  /** 3. Number of Members & Carpet Area Utilized. */
  resMembers: string;
  resArea: string;
  comMembers: string;
  comArea: string;
  /** 4. Additional Information. */
  additionalInfo: string;
};

export const EMPTY_DASHBOARD_ANSWERS: DashboardAnswers = {
  contactPerson: "",
  societyName: "",
  ctsNumber: "",
  district: "",
  taluka: "",
  village: "",
  address: "",
  googleLocation: "",
  ctsRecord: "",
  propertyCard: "",
  conveyanceFiles: [],
  dpRemarkFiles: [],
  plotAreaSqm: "",
  roadWidth: "",
  resMembers: "",
  resArea: "",
  comMembers: "",
  comArea: "",
  additionalInfo: "",
};

export type DashboardSectionId =
  | "basic"
  | "documents"
  | "members"
  | "additional";

export type DashboardSection = {
  id: DashboardSectionId;
  number: string;
  title: string;
};

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  { id: "basic", number: "01", title: "Basic Details" },
  { id: "documents", number: "02", title: "Feasibility & Property Documents" },
  {
    id: "members",
    number: "03",
    title: "Number of Members & Carpet Area Utilized",
  },
  { id: "additional", number: "04", title: "Additional Information" },
];

function parseNonNegative(value: string): number | null {
  const num = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(num) && num >= 0 ? num : null;
}

/** Total members: residential + commercial. Null while either side is not a number. */
export function membersTotal(answers: DashboardAnswers): number | null {
  const residential = parseNonNegative(answers.resMembers);
  const commercial = parseNonNegative(answers.comMembers);
  if (residential === null || commercial === null) return null;
  return residential + commercial;
}

/** Total carpet area in sq.ft: residential + commercial. Null while either side is not a number. */
export function carpetTotalSqft(answers: DashboardAnswers): number | null {
  const residential = parseNonNegative(answers.resArea);
  const commercial = parseNonNegative(answers.comArea);
  if (residential === null || commercial === null) return null;
  return residential + commercial;
}

/** Plot area in sq.ft — the file asks for sq.m; the enquiry carries sq.ft (× 10.764, rounded), as the intake form does. */
export function plotAreaSqft(answers: DashboardAnswers): number | null {
  const sqm = parseNonNegative(answers.plotAreaSqm);
  if (sqm === null) return null;
  return Math.round(sqm * 10.764);
}

/** Loose check that a pasted link looks like a Google Maps link. Drives a warning note only — it never blocks. */
export function isMapsLink(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v.startsWith("http") &&
    (v.includes("google.") || v.includes("goo.gl") || v.includes("maps"))
  );
}

/** Whether the society has given this section, in the form the section asks for. */
export function isSectionGiven(
  section: DashboardSectionId,
  answers: DashboardAnswers,
): boolean {
  switch (section) {
    case "basic":
      return (
        answers.societyName.trim() !== "" &&
        answers.ctsNumber.trim() !== "" &&
        answers.district.trim() !== ""
      );
    case "documents":
      return (
        answers.ctsRecord.trim() !== "" ||
        answers.propertyCard.trim() !== "" ||
        answers.conveyanceFiles.length > 0 ||
        answers.dpRemarkFiles.length > 0
      );
    case "members": {
      const total = membersTotal(answers);
      return total !== null && total > 0;
    }
    case "additional":
      return answers.additionalInfo.trim() !== "";
  }
}

export type DashboardReadiness = {
  sectionsGiven: number;
  sectionsTotal: number;
  ready: boolean;
  missing: DashboardSection[];
};

/**
 * Readiness to send: the Basic Details section (society, CTS,
 * district) and the Members section are given. The Documents section
 * and Additional Information are not blocking — the team can ask for
 * what is missing after the record arrives.
 */
export function dashboardReadiness(
  answers: DashboardAnswers,
): DashboardReadiness {
  const given = DASHBOARD_SECTIONS.filter((section) =>
    isSectionGiven(section.id, answers),
  );
  const ready =
    isSectionGiven("basic", answers) && isSectionGiven("members", answers);
  return {
    sectionsGiven: given.length,
    sectionsTotal: DASHBOARD_SECTIONS.length,
    ready,
    missing: DASHBOARD_SECTIONS.filter(
      (section) => !isSectionGiven(section.id, answers),
    ),
  };
}

export type DashboardContact = {
  role: string;
  phone: string;
  email: string;
  consent: boolean;
};

export const EMPTY_DASHBOARD_CONTACT: DashboardContact = {
  role: "",
  phone: "",
  email: "",
  consent: false,
};

/** Validation errors for sending the record, in plain language. Empty means it can be sent. */
export function validateDashboardSend(
  answers: DashboardAnswers,
  contact: DashboardContact,
): string[] {
  const errors: string[] = [];
  if (!answers.societyName.trim())
    errors.push("Please enter the name of your housing society.");
  if (!answers.ctsNumber.trim())
    errors.push("Please enter the CTS No. / F.P. No. of your plot.");
  if (!answers.district.trim())
    errors.push("Please choose the district your society is in.");
  if (!answers.contactPerson.trim())
    errors.push("Please enter the contact person for your society.");
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

function filesLine(label: string, files: string[]): string {
  if (files.length === 0) return `${label}: not given yet`;
  const names = files.map((name) => name.trim()).filter((name) => name !== "");
  if (names.length === 0) return `${label}: not given yet`;
  return `${label}: file${names.length === 1 ? "" : "s"} chosen — ${names.join("; ")} (send the file itself by email to info@nirmaq.in)`;
}

/**
 * Maps the dashboard record onto the existing requirement enquiry
 * payload. Everything the pipeline does not have a field for travels
 * in the brief as structured plain text — no field is dropped
 * silently. The file names chosen are listed; the files themselves
 * are emailed by the society, and the brief says so.
 */
export function buildDashboardEnquiryDetails(
  answers: DashboardAnswers,
  contact: DashboardContact,
): RequirementEnquiryDetails {
  const readiness = dashboardReadiness(answers);
  const memberCount = membersTotal(answers);
  const carpetTotal = carpetTotalSqft(answers);
  const plotSqft = plotAreaSqft(answers);

  const briefLines: string[] = [
    "Feasibility dashboard record — sent from the society feasibility dashboard",
    `Contact person: ${orNotGiven(answers.contactPerson)}`,
    `Name of Society / Property: ${orNotGiven(answers.societyName)}`,
    `CTS No. / F.P. No.: ${orNotGiven(answers.ctsNumber)}`,
    `District: ${orNotGiven(answers.district)}`,
    `Taluka: ${orNotGiven(answers.taluka)}`,
    `Village: ${orNotGiven(answers.village)}`,
    `Society Address: ${orNotGiven(answers.address)}`,
    `Google Location: ${orNotGiven(answers.googleLocation)}`,
    `CTS No. (Property Record): ${orNotGiven(answers.ctsRecord)}`,
    `Property Card: ${orNotGiven(answers.propertyCard)}`,
    filesLine("Conveyance", answers.conveyanceFiles),
    filesLine("DP Remark", answers.dpRemarkFiles),
    answers.plotAreaSqm.trim() === ""
      ? "Plot Area: not given yet"
      : `Plot Area: ${answers.plotAreaSqm.trim()} sq.m (${plotSqft === null ? "—" : plotSqft.toLocaleString("en-IN")} sq.ft)`,
    `Road Width: ${orNotGiven(answers.roadWidth)}`,
  ];
  if (memberCount !== null) {
    briefLines.push(
      `Members: ${answers.resMembers.trim() || "0"} residential, ${answers.comMembers.trim() || "0"} commercial (${memberCount} in total)`,
    );
  } else {
    briefLines.push("Members: not given yet");
  }
  if (carpetTotal !== null) {
    briefLines.push(
      `Carpet area utilized: ${answers.resArea.trim() || "0"} sq.ft residential, ${answers.comArea.trim() || "0"} sq.ft commercial (${carpetTotal.toLocaleString("en-IN")} sq.ft in total)`,
    );
  } else {
    briefLines.push("Carpet area utilized: not given yet");
  }
  briefLines.push(
    `Additional Information: ${orNotGiven(answers.additionalInfo)}`,
  );
  briefLines.push(
    readiness.ready
      ? "Basic details and members are given — ready for the team to review."
      : `Still needed before the team can review: ${readiness.missing.map((section) => section.title).join("; ")}`,
  );
  briefLines.push(
    "Documents to send by email: the files listed above are to be attached to an email to info@nirmaq.in — the record alone does not carry the files.",
  );

  return {
    societyName: answers.societyName.trim(),
    location: answers.district.trim() || "Not provided on this dashboard",
    societyType: "Co-operative Housing Society",
    memberCount: memberCount ?? 0,
    buildingAge: 0,
    landType: undefined,
    plotArea: plotSqft ?? undefined,
    conveyanceStatus:
      answers.conveyanceFiles.length === 0
        ? "Conveyance document not given yet"
        : "Conveyance document chosen — file to follow by email",
    structuralAudit: undefined,
    services: ["Feasibility review"],
    timeline: "Not specified",
    brief: briefLines.join("\n"),
    contactName: answers.contactPerson.trim(),
    contactRole: contact.role.trim() || "Committee member",
    phone: contact.phone.trim(),
    email: contact.email.trim(),
    consent: contact.consent,
  };
}
