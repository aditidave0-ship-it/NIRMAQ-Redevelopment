import { useEffect, useRef, useState } from "react";
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
  DOCUMENT_ITEMS,
  EMPTY_DOCUMENTS_CONTACT,
  EMPTY_DOCUMENT_ANSWERS,
  EMPTY_TEAM_STATUSES,
  TEAM_STATUS_LABELS,
  buildDocumentsEnquiryDetails,
  bifurcationTotal,
  carpetRowsGiven,
  carpetTotalSqft,
  documentsReadiness,
  isItemGiven,
  isMapsLink,
  teamReadiness,
  validateDocumentsSend,
} from "./feasibility-documents";
import type {
  DocumentAnswers,
  DocumentId,
  DocumentItem,
  DocumentsContact,
  TeamItemStatus,
  TeamStatuses,
} from "./feasibility-documents";

/**
 * Feasibility documents dashboard (/societies/documents).
 *
 * Aditi's eight items, 25 Nov 2026: the documents and details NIRMAQ
 * needs from a housing society before feasibility preparation can start.
 * Two views of the same checklist — the society gives (upload a file
 * where there is a document, type the detail where it is a number or a
 * link) and the NIRMAQ team tracks (the team marks each item verified
 * as it is checked).
 *
 * Honest about what this page does and does not do: the working
 * checklist is saved on the visitor's own device only while they
 * prepare it. Sending the checklist goes through the existing
 * requirement enquiry pipeline — the file names chosen and the details
 * typed in travel in the enquiry, and the files themselves are emailed
 * by the society to info@nirmaq.in. A failed save shows an honest
 * error with the email fallback, never fake success. Nothing here
 * promises an area, an FSI, or a return.
 */

type DashboardView = "society" | "team";

const STORAGE_KEY = "nirmaq.feasibility-documents.v1";
const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv";

type SavedState = {
  societyName: string;
  answers: DocumentAnswers;
  contact: DocumentsContact;
  teamStatuses: TeamStatuses;
};

function loadSavedState(): SavedState {
  const empty: SavedState = {
    societyName: "",
    answers: EMPTY_DOCUMENT_ANSWERS,
    contact: EMPTY_DOCUMENTS_CONTACT,
    teamStatuses: EMPTY_TEAM_STATUSES,
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    if (typeof parsed !== "object" || parsed === null) return empty;
    return {
      societyName:
        typeof parsed.societyName === "string" ? parsed.societyName : "",
      answers: {
        ...EMPTY_DOCUMENT_ANSWERS,
        ...(typeof parsed.answers === "object" && parsed.answers !== null
          ? parsed.answers
          : {}),
        bifurcation: {
          ...EMPTY_DOCUMENT_ANSWERS.bifurcation,
          ...(typeof parsed.answers?.bifurcation === "object" &&
          parsed.answers?.bifurcation !== null
            ? parsed.answers.bifurcation
            : {}),
        },
        carpet_areas: Array.isArray(parsed.answers?.carpet_areas)
          ? parsed.answers.carpet_areas
          : [],
      },
      contact: {
        ...EMPTY_DOCUMENTS_CONTACT,
        ...(typeof parsed.contact === "object" && parsed.contact !== null
          ? parsed.contact
          : {}),
      },
      teamStatuses: {
        ...EMPTY_TEAM_STATUSES,
        ...(typeof parsed.teamStatuses === "object" &&
        parsed.teamStatuses !== null
          ? parsed.teamStatuses
          : {}),
      },
    };
  } catch {
    return empty;
  }
}

export function FeasibilityDocumentsPage() {
  const [saved] = useState(loadSavedState);
  const [societyName, setSocietyName] = useState(saved.societyName);
  const [answers, setAnswers] = useState<DocumentAnswers>(saved.answers);
  const [contact, setContact] = useState<DocumentsContact>(saved.contact);
  const [teamStatuses, setTeamStatuses] = useState<TeamStatuses>(
    saved.teamStatuses,
  );
  const [view, setView] = useState<DashboardView>("society");
  const [sendErrors, setSendErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sentReference, setSentReference] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const rowCounter = useRef(0);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ societyName, answers, contact, teamStatuses }),
      );
    } catch {
      // Saving on this device is a convenience, not the handover — a
      // full or blocked local store must never break the page.
    }
  }, [societyName, answers, contact, teamStatuses]);

  const readiness = documentsReadiness(answers);
  const team = teamReadiness(answers, teamStatuses);
  const bifurcation = bifurcationTotal(answers);
  const carpetTotal = carpetTotalSqft(answers);
  const carpetRows = carpetRowsGiven(answers);

  function setTextAnswer(id: "google_location" | "cts_number", value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function setFileAnswer(id: DocumentId, fileName: string) {
    setAnswers((current) => ({ ...current, [id]: fileName }));
  }

  function handleFileChange(id: DocumentId, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setFileAnswer(id, file.name);
  }

  function setBifurcation(
    field: "residential" | "commercial",
    value: string,
  ) {
    setAnswers((current) => ({
      ...current,
      bifurcation: { ...current.bifurcation, [field]: value },
    }));
  }

  function addCarpetRow() {
    rowCounter.current += 1;
    const id = `carpet-row-${rowCounter.current}`;
    setAnswers((current) => ({
      ...current,
      carpet_areas: [...current.carpet_areas, { id, label: "", area: "" }],
    }));
  }

  function setCarpetRow(
    id: string,
    field: "label" | "area",
    value: string,
  ) {
    setAnswers((current) => ({
      ...current,
      carpet_areas: current.carpet_areas.map((row) =>
        row.id === id ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function removeCarpetRow(id: string) {
    setAnswers((current) => ({
      ...current,
      carpet_areas: current.carpet_areas.filter((row) => row.id !== id),
    }));
  }

  function setTeamStatus(id: DocumentId, status: TeamItemStatus) {
    setTeamStatuses((current) => ({ ...current, [id]: status }));
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const errors = validateDocumentsSend(societyName, contact, answers);
    setSendErrors(errors);
    setSendError(null);
    if (errors.length > 0) return;
    setSending(true);
    try {
      const reference = await sendRequirementEnquiry(
        buildDocumentsEnquiryDetails(societyName, contact, answers),
      );
      setSentReference(reference);
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : "Your checklist could not be sent. Please try again later.",
      );
    } finally {
      setSending(false);
    }
  }

  function itemStatus(item: DocumentItem): {
    label: string;
    className: string;
  } {
    if (teamStatuses[item.id] === "verified")
      return {
        label: "Verified by NIRMAQ team",
        className: "experience-document-status--verified",
      };
    if (isItemGiven(item, answers))
      return {
        label: "Given — awaiting check",
        className: "experience-document-status--given",
      };
    return {
      label: "Not given yet",
      className: "experience-document-status--pending",
    };
  }

  function renderItemInput(item: DocumentItem) {
    switch (item.id) {
      case "google_location":
        return (
          <>
            <label>
              Google Maps link
              <input
                type="text"
                inputMode="url"
                placeholder={item.placeholder}
                value={answers.google_location}
                onChange={(event) =>
                  setTextAnswer("google_location", event.target.value)
                }
              />
            </label>
            {answers.google_location.trim() !== "" &&
              !isMapsLink(answers.google_location) && (
                <p className="experience-step-note">
                  This does not look like a Google Maps link — please check
                  it before sending.
                </p>
              )}
            {answers.google_location.trim() !== "" &&
              isMapsLink(answers.google_location) && (
                <p className="experience-step-note">
                  <a
                    href={answers.google_location.trim()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open this location in Google Maps →
                  </a>
                </p>
              )}
          </>
        );
      case "cts_number":
        return (
          <label>
            CTS number
            <input
              type="text"
              placeholder={item.placeholder}
              value={answers.cts_number}
              onChange={(event) =>
                setTextAnswer("cts_number", event.target.value)
              }
            />
          </label>
        );
      case "dp_remark":
      case "property_card":
      case "conveyance":
      case "member_list": {
        const fileName = answers[item.id];
        return (
          <>
            <p className="no-print">
              <label className="experience-button">
                <FileUp size={16} />
                {fileName === "" ? "Choose file" : "Choose a different file"}
                <input
                  key={fileName || "empty"}
                  type="file"
                  accept={FILE_ACCEPT}
                  hidden
                  onChange={(event) => handleFileChange(item.id, event)}
                />
              </label>
            </p>
            {fileName !== "" ? (
              <p>
                Chosen: <strong>{fileName}</strong>{" "}
                <button
                  type="button"
                  className="experience-text-button"
                  onClick={() => setFileAnswer(item.id, "")}
                >
                  Remove
                </button>
              </p>
            ) : (
              <p className="experience-step-note">
                PDF, photo or scan — the file itself is emailed to
                info@nirmaq.in when you send the checklist.
              </p>
            )}
          </>
        );
      }
      case "bifurcation":
        return (
          <>
            <div className="experience-form-row">
              <label>
                Residential members
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 38"
                  value={answers.bifurcation.residential}
                  onChange={(event) =>
                    setBifurcation("residential", event.target.value)
                  }
                />
              </label>
              <label>
                Commercial members (shops / offices)
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 2"
                  value={answers.bifurcation.commercial}
                  onChange={(event) =>
                    setBifurcation("commercial", event.target.value)
                  }
                />
              </label>
            </div>
            {bifurcation !== null && (
              <p className="experience-step-note">
                Total members: <strong>{bifurcation}</strong>
              </p>
            )}
          </>
        );
      case "carpet_areas":
        return (
          <>
            <div className="experience-carpet-rows">
              {answers.carpet_areas.map((row, index) => (
                <div
                  className="experience-carpet-row"
                  key={row.id}
                >
                  <label>
                    Flat / member {index + 1}
                    <input
                      type="text"
                      placeholder={`e.g. Flat ${index + 1}`}
                      value={row.label}
                      onChange={(event) =>
                        setCarpetRow(row.id, "label", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Carpet area (sq.ft)
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 520"
                      value={row.area}
                      onChange={(event) =>
                        setCarpetRow(row.id, "area", event.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="experience-text-button"
                    onClick={() => removeCarpetRow(row.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <p className="no-print">
              <button
                type="button"
                className="experience-button"
                onClick={addCarpetRow}
              >
                Add a flat
              </button>
            </p>
            {carpetRows > 0 && (
              <p className="experience-step-note">
                Total carpet area:{" "}
                <strong>{carpetTotal.toLocaleString("en-IN")} sq.ft</strong>{" "}
                across {carpetRows} flat{carpetRows === 1 ? "" : "s"}.
              </p>
            )}
          </>
        );
    }
  }

  function renderTeamSummary(item: DocumentItem) {
    switch (item.id) {
      case "google_location":
        return answers.google_location.trim() === "" ? (
          <p className="experience-step-note">Not given yet.</p>
        ) : (
          <p>
            <a
              href={answers.google_location.trim()}
              target="_blank"
              rel="noreferrer"
            >
              {answers.google_location.trim()}
            </a>
          </p>
        );
      case "cts_number":
        return answers.cts_number.trim() === "" ? (
          <p className="experience-step-note">Not given yet.</p>
        ) : (
          <p>
            CTS number: <strong>{answers.cts_number.trim()}</strong>
          </p>
        );
      case "dp_remark":
      case "property_card":
      case "conveyance":
      case "member_list":
        return answers[item.id].trim() === "" ? (
          <p className="experience-step-note">No file chosen yet.</p>
        ) : (
          <p>
            File chosen: <strong>{answers[item.id].trim()}</strong> — to
            arrive by email to info@nirmaq.in.
          </p>
        );
      case "bifurcation":
        return bifurcation === null ? (
          <p className="experience-step-note">Not given yet.</p>
        ) : (
          <p>
            {answers.bifurcation.residential.trim()} residential,{" "}
            {answers.bifurcation.commercial.trim()} commercial —{" "}
            <strong>{bifurcation} members in total</strong>.
          </p>
        );
      case "carpet_areas":
        return carpetRows === 0 ? (
          <p className="experience-step-note">Not given yet.</p>
        ) : (
          <p>
            {carpetRows} flat{carpetRows === 1 ? "" : "s"} listed — total{" "}
            <strong>{carpetTotal.toLocaleString("en-IN")} sq.ft</strong>.
          </p>
        );
    }
  }

  return (
    <div className="renova-experience">
      <ExperienceHeader />
      <main
        id="main-content"
        className="experience-container experience-info-page"
      >
        <div className="print-only">
          <h2>NIRMAQ.IN — Society Feasibility Documents</h2>
          <p>
            For the Managing Committee — the eight things NIRMAQ needs for
            feasibility preparation. Complete online at
            nirmaq.in/societies/documents.
          </p>
        </div>
        <span className="experience-eyebrow">
          For housing societies · Feasibility documents
        </span>
        <h1>Your feasibility documents — in one place.</h1>
        <p>
          The eight things NIRMAQ needs from your society before feasibility
          preparation can start. Give each one here — upload the document
          where there is one, type the detail where it is a number or a
          link. Nothing here is a promise of area, FSI or returns — the
          detailed study is where real numbers are worked out.
        </p>
        <p>
          <Link href="/societies">← Back to the societies page</Link>
          {" · "}
          <Link href="/societies/intake-form">
            Fill in the intake form →
          </Link>
        </p>
        <p className="experience-step-note">
          This page saves your checklist on this device only while you
          prepare it. Sending the checklist goes through NIRMAQ&rsquo;s
          enquiry system; the files themselves you email to info@nirmaq.in.
        </p>

        <div className="experience-tentative-card no-print">
          <label>
            Name of Co-operative Housing Society
            <input
              type="text"
              placeholder="e.g. Shanti Sagar Co-op Housing Society Ltd."
              value={societyName}
              onChange={(event) => setSocietyName(event.target.value)}
            />
          </label>
        </div>

        <div
          className="experience-view-toggle no-print"
          role="group"
          aria-label="Dashboard view"
        >
          <button
            type="button"
            className="experience-button"
            aria-pressed={view === "society"}
            onClick={() => setView("society")}
          >
            Society view
          </button>
          <button
            type="button"
            className="experience-button"
            aria-pressed={view === "team"}
            onClick={() => setView("team")}
          >
            Team view
          </button>
        </div>
        <p className="experience-step-note no-print">
          {view === "society"
            ? "Society view — your committee gives each document or detail."
            : "Team view — the NIRMAQ team tracks each society's documents and marks them verified as they are checked."}
        </p>

        {view === "society" ? (
          <>
            <section
              className={`experience-tentative-result ${
                readiness.ready
                  ? "experience-tentative-result--favourable"
                  : "experience-tentative-result--challenging"
              }`}
              aria-label="Readiness for feasibility preparation"
            >
              <ClipboardCheck size={26} />
              <span className="experience-eyebrow">
                Readiness for feasibility preparation
              </span>
              <h3>
                {readiness.ready
                  ? "Ready for feasibility preparation"
                  : `${readiness.compulsoryGiven} of ${readiness.compulsoryTotal} compulsory items given`}
              </h3>
              <div
                className="experience-readiness-bar"
                role="progressbar"
                aria-valuenow={readiness.compulsoryGiven}
                aria-valuemin={0}
                aria-valuemax={readiness.compulsoryTotal}
                aria-label="Compulsory items given"
              >
                <span
                  style={{
                    width: `${(readiness.compulsoryGiven / readiness.compulsoryTotal) * 100}%`,
                  }}
                />
              </div>
              <p>
                {readiness.totalGiven} of {readiness.total} items given in
                total.
              </p>
              {readiness.ready ? (
                <p>
                  All six compulsory items are given. Send the checklist
                  below and the team can start feasibility preparation.
                </p>
              ) : (
                <ul>
                  {readiness.missingCompulsory.map((item) => (
                    <li key={item.id}>Still needed: {item.title}</li>
                  ))}
                </ul>
              )}
            </section>

            <div className="experience-documents-list">
              {DOCUMENT_ITEMS.map((item, index) => {
                const status = itemStatus(item);
                return (
                  <section
                    className="experience-tentative-card experience-document-card"
                    key={item.id}
                    aria-label={item.title}
                  >
                    <div className="experience-document-head">
                      <h2>
                        {index + 1}. {item.title}
                      </h2>
                      <span
                        className={`experience-document-status ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p>
                      {item.compulsory ? (
                        <strong>Compulsory. </strong>
                      ) : (
                        <strong>Optional. </strong>
                      )}
                      {item.help}
                    </p>
                    {renderItemInput(item)}
                  </section>
                );
              })}
            </div>

            <section className="experience-tentative-card">
              <h2>Your contact — so we can reply</h2>
              <div className="experience-form-row">
                <label>
                  Committee contact name
                  <input
                    type="text"
                    placeholder="e.g. Anita Desai"
                    value={contact.name}
                    onChange={(event) =>
                      setContact((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
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
              </div>
              <div className="experience-form-row">
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

            <section className="experience-tentative-card">
              <h2>Anything specific to tell us? (compulsory)</h2>
              <p>
                If you want a specific regulation, a percentage of extra
                area, or anything else — write it here. The NIRMAQ team
                reads this before the detailed study, and it travels with
                your enquiry.
              </p>
              <label>
                Your remarks
                <textarea
                  rows={4}
                  placeholder="e.g. We would like 20% extra area. If possible, we would like the redevelopment under Regulation 33(7)(B)."
                  value={answers.remarks}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      remarks: event.target.value,
                    }))
                  }
                />
              </label>
            </section>

            {sentReference ? (
              <div className="experience-confirmation" role="status">
                <CheckCircle2 size={32} />
                <h3>Your checklist is with NIRMAQ.</h3>
                <p>
                  Reference: <strong>{sentReference}</strong>. Keep this
                  for your records — the NIRMAQ team will review your
                  checklist and be in touch.
                </p>
                <p>
                  Remember to email the files you chose to info@nirmaq.in —
                  the checklist alone does not carry the files.
                </p>
              </div>
            ) : (
              <form
                className="experience-tentative-card no-print"
                onSubmit={handleSend}
              >
                <h2>Send this checklist to NIRMAQ</h2>
                <p>
                  Sending the checklist does not send the files — attach the
                  files you chose to an email to info@nirmaq.in. The
                  checklist tells the team what is coming.
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
                    {sendError} You can also email your checklist directly
                    to info@nirmaq.in.
                  </p>
                )}
                <button
                  type="submit"
                  className="experience-button"
                  disabled={sending}
                >
                  {sending
                    ? "Sending…"
                    : "Send this checklist to NIRMAQ"}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}

            <p className="no-print">
              <button
                type="button"
                className="experience-button"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                Print this checklist for your committee
              </button>
            </p>
          </>
        ) : (
          <>
            <section
              className="experience-tentative-result"
              aria-label="Team tracking summary"
            >
              <ClipboardCheck size={26} />
              <span className="experience-eyebrow">
                Team tracking — {societyName.trim() || "Society not named yet"}
              </span>
              <h3>
                {team.verifiedCompulsory} of {team.compulsoryTotal}{" "}
                compulsory items verified
              </h3>
              <p>
                {readiness.totalGiven} of {readiness.total} items given by
                the society.
              </p>
              {team.blocking.length === 0 ? (
                <p>
                  Nothing compulsory is blocking the detailed study — the
                  team can start feasibility preparation.
                </p>
              ) : (
                <ul>
                  {team.blocking.map((item) => (
                    <li key={item.id}>
                      Still blocking: {item.title} —{" "}
                      {isItemGiven(item, answers)
                        ? "given, not verified yet"
                        : "not given yet"}
                    </li>
                  ))}
                </ul>
              )}
              <p className="experience-tentative-disclaimer">
                Team view — preview. In the live system the team sees every
                society here, and marks each document verified as it is
                checked.
              </p>
            </section>

            <section className="experience-tentative-card">
              <h2>Society&apos;s remarks</h2>
              {answers.remarks.trim() ? (
                <p>{answers.remarks.trim()}</p>
              ) : (
                <p>
                  Not written yet — the society writes its remarks before
                  sending.
                </p>
              )}
            </section>

            <div className="experience-documents-list">
              {DOCUMENT_ITEMS.map((item, index) => {
                const status = itemStatus(item);
                return (
                  <section
                    className="experience-tentative-card experience-document-card"
                    key={item.id}
                    aria-label={item.title}
                  >
                    <div className="experience-document-head">
                      <h2>
                        {index + 1}. {item.title}
                      </h2>
                      <span
                        className={`experience-document-status ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p>
                      {item.compulsory ? (
                        <strong>Compulsory. </strong>
                      ) : (
                        <strong>Optional. </strong>
                      )}
                      {item.help}
                    </p>
                    {renderTeamSummary(item)}
                    <div className="experience-document-actions no-print">
                      <button
                        type="button"
                        className="experience-button"
                        aria-pressed={teamStatuses[item.id] === "verified"}
                        onClick={() => setTeamStatus(item.id, "verified")}
                      >
                        Mark verified
                      </button>
                      <button
                        type="button"
                        className="experience-button"
                        aria-pressed={teamStatuses[item.id] === "needs_again"}
                        onClick={() => setTeamStatus(item.id, "needs_again")}
                      >
                        Ask for another copy
                      </button>
                      <button
                        type="button"
                        className="experience-text-button"
                        onClick={() => setTeamStatus(item.id, "awaiting")}
                      >
                        Clear
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </main>
      <ExperienceFooter />
    </div>
  );
}
