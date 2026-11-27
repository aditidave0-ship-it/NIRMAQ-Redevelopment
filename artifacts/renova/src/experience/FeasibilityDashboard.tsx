import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileUp,
  Printer,
} from "lucide-react";
import { ExperienceFooter, ExperienceHeader } from "./Header";
import { sendRequirementEnquiry } from "./requirement-enquiry";
import {
  DEMO_DASHBOARD,
  DISTRICT_OPTIONS,
  EMPTY_DASHBOARD_ANSWERS,
  EMPTY_DASHBOARD_CONTACT,
  PROPERTY_CARD_OPTIONS,
  ROAD_WIDTH_OPTIONS,
  TALUKA_OPTIONS,
  buildDashboardEnquiryDetails,
  carpetTotalSqft,
  dashboardReadiness,
  isMapsLink,
  membersTotal,
  validateDashboardSend,
} from "./feasibility-dashboard";
import type {
  DashboardAnswers,
  DashboardContact,
} from "./feasibility-dashboard";

/**
 * Feasibility Dashboard (/feasibility-dashboard).
 *
 * The society contact-person dashboard — the standalone file Aditi
 * sent on 27 Nov 2026, as a page on the site in its approved no-box
 * "Society File" look. The society fills it in here. The NIRMAQ
 * team sees the record through the enquiry, at info@nirmaq.in —
 * there is no team view on this page (Aditi, 27 Nov 2026).
 *
 * Honest about what this page does and does not do: the working
 * record is saved on the visitor's own device only while they
 * prepare it. Sending the record goes through the existing
 * requirement enquiry pipeline — the details travel in the enquiry,
 * and the files themselves are emailed by the society to
 * info@nirmaq.in. A failed send shows an honest error with the email
 * fallback, never fake success. Nothing here promises an area, an
 * FSI, or a return — the totals shown are the society's own figures
 * added up, nothing more.
 */

const STORAGE_KEY = "nirmaq.feasibility-dashboard.v1";
const FILE_ACCEPT = "image/*,.pdf";

type SavedState = {
  answers: DashboardAnswers;
  contact: DashboardContact;
  /** True while the Dharma Nagar example details are loaded. */
  demoLoaded: boolean;
};

function loadSavedState(): SavedState {
  const empty: SavedState = {
    answers: EMPTY_DASHBOARD_ANSWERS,
    contact: EMPTY_DASHBOARD_CONTACT,
    demoLoaded: false,
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    if (typeof parsed !== "object" || parsed === null) return empty;
    return {
      answers: {
        ...EMPTY_DASHBOARD_ANSWERS,
        ...(typeof parsed.answers === "object" && parsed.answers !== null
          ? parsed.answers
          : {}),
        conveyanceFiles: Array.isArray(parsed.answers?.conveyanceFiles)
          ? parsed.answers.conveyanceFiles
          : [],
        dpRemarkFiles: Array.isArray(parsed.answers?.dpRemarkFiles)
          ? parsed.answers.dpRemarkFiles
          : [],
      },
      contact: {
        ...EMPTY_DASHBOARD_CONTACT,
        ...(typeof parsed.contact === "object" && parsed.contact !== null
          ? parsed.contact
          : {}),
      },
      demoLoaded: parsed.demoLoaded === true,
    };
  } catch {
    return empty;
  }
}

export function FeasibilityDashboardPage() {
  const [saved] = useState(loadSavedState);
  const [answers, setAnswers] = useState<DashboardAnswers>(saved.answers);
  const [contact, setContact] = useState<DashboardContact>(saved.contact);
  const [demoLoaded, setDemoLoaded] = useState(saved.demoLoaded);
  const [sendErrors, setSendErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sentReference, setSentReference] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ answers, contact, demoLoaded }),
      );
    } catch {
      // Saving on this device is a convenience, not the handover — a
      // full or blocked local store must never break the page.
    }
  }, [answers, contact, demoLoaded]);

  const readiness = dashboardReadiness(answers);
  const members = membersTotal(answers);
  const carpetTotal = carpetTotalSqft(answers);

  function setText(
    field:
      | "contactPerson"
      | "societyName"
      | "ctsNumber"
      | "district"
      | "taluka"
      | "village"
      | "address"
      | "googleLocation"
      | "ctsRecord"
      | "propertyCard"
      | "plotAreaSqm"
      | "roadWidth"
      | "resMembers"
      | "resArea"
      | "comMembers"
      | "comArea"
      | "additionalInfo",
    value: string,
  ) {
    setAnswers((current) => ({ ...current, [field]: value }));
  }

  /**
   * Load the Dharma Nagar example details. Only offered on an empty
   * dashboard, so it can never overwrite something the society typed.
   * The demo fills only the details the lead sheet has — everything
   * else stays empty, and the send validation still blocks sending
   * until a real contact is filled in.
   */
  function loadDemo() {
    setAnswers(DEMO_DASHBOARD.answers);
    setDemoLoaded(true);
  }

  function clearDemo() {
    setAnswers(EMPTY_DASHBOARD_ANSWERS);
    setContact(EMPTY_DASHBOARD_CONTACT);
    setDemoLoaded(false);
  }

  function handleFiles(
    field: "conveyanceFiles" | "dpRemarkFiles",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const names = Array.from(files, (file) => file.name);
    setAnswers((current) => ({
      ...current,
      [field]: [...current[field], ...names],
    }));
    event.target.value = "";
  }

  function removeFile(
    field: "conveyanceFiles" | "dpRemarkFiles",
    index: number,
  ) {
    setAnswers((current) => ({
      ...current,
      [field]: current[field].filter((_, i) => i !== index),
    }));
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const errors = validateDashboardSend(answers, contact);
    setSendErrors(errors);
    setSendError(null);
    if (errors.length > 0) return;
    setSending(true);
    try {
      const reference = await sendRequirementEnquiry(
        buildDashboardEnquiryDetails(answers, contact),
      );
      setSentReference(reference);
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : "Your record could not be sent. Please try again later.",
      );
    } finally {
      setSending(false);
    }
  }

  function renderFileField(
    field: "conveyanceFiles" | "dpRemarkFiles",
    label: string,
    hint: string,
  ) {
    const files = answers[field];
    return (
      <>
        <p className="no-print">
          <label className="experience-button">
            <FileUp size={16} />
            {files.length === 0 ? "Choose files" : "Choose more files"}
            <input
              type="file"
              accept={FILE_ACCEPT}
              multiple
              hidden
              onChange={(event) => handleFiles(field, event)}
            />
          </label>
        </p>
        {files.length > 0 ? (
          <ul className="experience-dashboard-filelist">
            {files.map((name, index) => (
              <li key={`${field}-${index}`}>
                <span>{name}</span>
                <button
                  type="button"
                  className="experience-text-button"
                  onClick={() => removeFile(field, index)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="experience-step-note">{hint}</p>
        )}
      </>
    );
  }

  return (
    <div className="renova-experience">
      <ExperienceHeader />
      <main
        id="main-content"
        className="experience-container experience-info-page experience-feasibility-dashboard"
      >
        <div className="print-only">
          <h2>NIRMAQ.IN — Society Feasibility Dashboard</h2>
          <p>
            For the Managing Committee — your society and property details
            for feasibility preparation. Complete online at
            nirmaq.in/feasibility-dashboard.
          </p>
        </div>
        <span className="experience-eyebrow">
          For housing societies · Feasibility dashboard
        </span>
        <h1>Your feasibility dashboard.</h1>
        <p>
          Start with your society and property information. Request an
          assessment from the NIRMAQ team to understand the next steps.
          Feasibility requires professional review — no automated
          development potential or financial projections are promised.
        </p>
        <p>
          <Link href="/">← Back to the homepage</Link>
          {" · "}
          <Link href="/feasibility-check">
            See the feasibility check →
          </Link>
        </p>
        <p className="experience-step-note">
          This page saves your record on this device only while you
          prepare it. Sending the record goes through NIRMAQ&rsquo;s
          enquiry system; the files themselves you email to info@nirmaq.in.
        </p>

        <>
            {demoLoaded && (
              <div className="experience-demo-banner no-print" role="status">
                <p>
                  <strong>Demo data — </strong>Showing example details for
                  Dharma Nagar CHSL — replace with your society&apos;s
                  details.
                </p>
                <button
                  type="button"
                  className="experience-button"
                  onClick={clearDemo}
                >
                  Clear demo data
                </button>
              </div>
            )}

            {!demoLoaded &&
              readiness.sectionsGiven === 0 &&
              !answers.societyName.trim() && (
                <div className="experience-tentative-card no-print">
                  <p>
                    See how the dashboard looks with a real society&apos;s
                    details — Dharma Nagar CHSL, Borivali West (example
                    data).
                  </p>
                  <button
                    type="button"
                    className="experience-button"
                    onClick={loadDemo}
                  >
                    Try a demo society
                  </button>
                </div>
              )}

            <section
              className={`experience-tentative-result ${
                readiness.ready
                  ? "experience-tentative-result--favourable"
                  : "experience-tentative-result--challenging"
              }`}
              aria-label="Readiness for the team to review"
            >
              <ClipboardCheck size={26} />
              <span className="experience-eyebrow">
                Readiness for the team to review
              </span>
              <h3>
                {readiness.ready
                  ? "Ready for the team to review"
                  : `${readiness.sectionsGiven} of ${readiness.sectionsTotal} sections given`}
              </h3>
              <p>
                Basic details and members are what the team needs first —
                documents and notes can follow.
              </p>
              {!readiness.ready && (
                <ul>
                  {readiness.missing.map((section) => (
                    <li key={section.id}>Still needed: {section.title}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="experience-dashboard-section">
              <h2>
                <span className="experience-dashboard-number">01</span>{" "}
                Basic Details
              </h2>
              <div className="experience-dashboard-grid">
                <label>
                  Contact Person
                  <input
                    type="text"
                    placeholder="Enter contact person"
                    value={answers.contactPerson}
                    onChange={(event) =>
                      setText("contactPerson", event.target.value)
                    }
                  />
                </label>
                <label>
                  Name of Society / Property *
                  <input
                    type="text"
                    placeholder="Enter name"
                    value={answers.societyName}
                    onChange={(event) =>
                      setText("societyName", event.target.value)
                    }
                  />
                </label>
                <label>
                  CTS No. / F.P. No. *
                  <input
                    type="text"
                    placeholder="Enter CTS No. / F.P. No."
                    value={answers.ctsNumber}
                    onChange={(event) =>
                      setText("ctsNumber", event.target.value)
                    }
                  />
                </label>
                <label>
                  District *
                  <select
                    value={answers.district}
                    onChange={(event) =>
                      setText("district", event.target.value)
                    }
                  >
                    <option value="">Select District</option>
                    {DISTRICT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Taluka
                  <select
                    value={answers.taluka}
                    onChange={(event) =>
                      setText("taluka", event.target.value)
                    }
                  >
                    <option value="">Select Taluka</option>
                    {TALUKA_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Village
                  <input
                    type="text"
                    placeholder="Enter / select Village"
                    value={answers.village}
                    onChange={(event) =>
                      setText("village", event.target.value)
                    }
                  />
                </label>
                <label className="experience-dashboard-field--full">
                  Society Address
                  <textarea
                    rows={3}
                    placeholder="Enter complete address"
                    value={answers.address}
                    onChange={(event) =>
                      setText("address", event.target.value)
                    }
                  />
                </label>
                <label className="experience-dashboard-field--full">
                  Google Location
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="Paste Google Maps link"
                    value={answers.googleLocation}
                    onChange={(event) =>
                      setText("googleLocation", event.target.value)
                    }
                  />
                </label>
              </div>
              {answers.googleLocation.trim() !== "" &&
                !isMapsLink(answers.googleLocation) && (
                  <p className="experience-step-note">
                    This does not look like a Google Maps link — please
                    check it before sending.
                  </p>
                )}
              {answers.googleLocation.trim() !== "" &&
                isMapsLink(answers.googleLocation) && (
                  <p className="experience-step-note">
                    <a
                      href={answers.googleLocation.trim()}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open this location in Google Maps →
                    </a>
                  </p>
                )}
            </section>

            <section className="experience-dashboard-section">
              <h2>
                <span className="experience-dashboard-number">02</span>{" "}
                Feasibility &amp; Property Documents
              </h2>
              <div className="experience-dashboard-grid">
                <label>
                  CTS No. (Property Record)
                  <input
                    type="text"
                    placeholder="Enter CTS number"
                    value={answers.ctsRecord}
                    onChange={(event) =>
                      setText("ctsRecord", event.target.value)
                    }
                  />
                </label>
                <label>
                  Property Card
                  <select
                    value={answers.propertyCard}
                    onChange={(event) =>
                      setText("propertyCard", event.target.value)
                    }
                  >
                    <option value="">Select Status</option>
                    {PROPERTY_CARD_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <span className="experience-dashboard-label">
                    Conveyance – Attachment
                  </span>
                  {renderFileField(
                    "conveyanceFiles",
                    "Conveyance – Attachment",
                    "Upload one or more conveyance photos or documents · JPG, JPEG, PNG, PDF — the file itself is emailed to info@nirmaq.in when you send the record.",
                  )}
                </div>
                <div>
                  <span className="experience-dashboard-label">
                    DP Remark – Attachment
                  </span>
                  {renderFileField(
                    "dpRemarkFiles",
                    "DP Remark – Attachment",
                    "Upload one or more photos or documents · JPG, JPEG, PNG, PDF — the file itself is emailed to info@nirmaq.in when you send the record.",
                  )}
                </div>
                <label>
                  Plot Area (Sq. m.)
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter plot area"
                    value={answers.plotAreaSqm}
                    onChange={(event) =>
                      setText("plotAreaSqm", event.target.value)
                    }
                  />
                </label>
                <label>
                  Road Width
                  <select
                    value={answers.roadWidth}
                    onChange={(event) =>
                      setText("roadWidth", event.target.value)
                    }
                  >
                    <option value="">Select Road Width</option>
                    {ROAD_WIDTH_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="experience-dashboard-section">
              <h2>
                <span className="experience-dashboard-number">03</span>{" "}
                Number of Members &amp; Carpet Area Utilized
              </h2>
              <div className="experience-dashboard-grid">
                <label>
                  Residential Members
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={answers.resMembers}
                    onChange={(event) =>
                      setText("resMembers", event.target.value)
                    }
                  />
                </label>
                <label>
                  Residential Carpet Area (Sq. ft.)
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={answers.resArea}
                    onChange={(event) =>
                      setText("resArea", event.target.value)
                    }
                  />
                </label>
                <label>
                  Commercial Members
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={answers.comMembers}
                    onChange={(event) =>
                      setText("comMembers", event.target.value)
                    }
                  />
                </label>
                <label>
                  Commercial Carpet Area (Sq. ft.)
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={answers.comArea}
                    onChange={(event) =>
                      setText("comArea", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="experience-dashboard-totals">
                <div>
                  <span>Total Members</span>
                  <strong>
                    {members === null ? "—" : members.toLocaleString("en-IN")}
                  </strong>
                </div>
                <div>
                  <span>Total Carpet Area (Sq. ft.)</span>
                  <strong>
                    {carpetTotal === null
                      ? "—"
                      : carpetTotal.toLocaleString("en-IN")}
                  </strong>
                </div>
              </div>
            </section>

            <section className="experience-dashboard-section">
              <h2>
                <span className="experience-dashboard-number">04</span>{" "}
                Additional Information
              </h2>
              <label>
                Additional Information
                <textarea
                  rows={4}
                  placeholder="Enter additional information"
                  value={answers.additionalInfo}
                  onChange={(event) =>
                    setText("additionalInfo", event.target.value)
                  }
                />
              </label>
            </section>

            <section className="experience-dashboard-section">
              <h2>Your contact — so we can reply</h2>
              <p>
                The contact person above is who we will speak to. Add a
                phone number and email so the team can reach them.
              </p>
              <div className="experience-dashboard-grid">
                <label>
                  Role in the society
                  <input
                    type="text"
                    placeholder="e.g. Secretary"
                    value={contact.role}
                    onChange={(event) =>
                      setContact((current) => ({
                        ...current,
                        role: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Phone
                  <input
                    type="text"
                    inputMode="tel"
                    placeholder="e.g. 98200 12345"
                    value={contact.phone}
                    onChange={(event) =>
                      setContact((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    placeholder="e.g. secretary@society.in"
                    value={contact.email}
                    onChange={(event) =>
                      setContact((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label className="experience-consent">
                <input
                  type="checkbox"
                  checked={contact.consent}
                  onChange={(event) =>
                    setContact((current) => ({
                      ...current,
                      consent: event.target.checked,
                    }))
                  }
                />
                NIRMAQ may contact our society about this enquiry.
              </label>
            </section>

            {sentReference ? (
              <div className="experience-confirmation" role="status">
                <CheckCircle2 size={32} />
                <h3>Your record is with NIRMAQ.</h3>
                <p>
                  Reference: <strong>{sentReference}</strong>. Keep this
                  for your records — the NIRMAQ team will review your
                  record and be in touch.
                </p>
                <p>
                  Remember to email the files you chose to info@nirmaq.in —
                  the record alone does not carry the files.
                </p>
              </div>
            ) : (
              <form
                className="experience-tentative-card no-print"
                onSubmit={handleSend}
              >
                <h2>Send this record to NIRMAQ</h2>
                <p>
                  Sending the record does not send the files — attach the
                  files you chose to an email to info@nirmaq.in. The record
                  tells the team what is coming.
                </p>
                {sendErrors.length > 0 && (
                  <div className="experience-error" role="alert">
                    <strong>Please fix the following:</strong>
                    <ul>
                      {sendErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {sendError && (
                  <p className="experience-error" role="alert">
                    {sendError} You can also email your record directly to
                    info@nirmaq.in.
                  </p>
                )}
                <button
                  type="submit"
                  className="experience-button"
                  disabled={sending}
                >
                  {sending ? "Sending…" : "Send this record to NIRMAQ"}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}

            <p className="no-print experience-dashboard-print">
              <button
                type="button"
                className="experience-button"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                Print this record for your committee
              </button>
            </p>
          </>

      </main>
      <ExperienceFooter />
    </div>
  );
}
