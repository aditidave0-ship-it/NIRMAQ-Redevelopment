import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { ExperienceFooter, ExperienceHeader } from "./Header";
import {
  PRIVACY_REQUEST_TYPES,
  PRIVACY_REQUEST_TYPE_LABELS,
  buildPrivacyRequestPayload,
  privacyRequestNextSteps,
  type PrivacyRequestType,
} from "./privacy-request";

// Prompt K Task 2a — public privacy-request form (request path only).
// Submits to the existing POST /privacy/requests and shows the returned
// reference. It files a verified request for the NIRMAQ team to review;
// it does not delete anything, and its copy promises nothing about
// backups, server logs or cache — the team confirms the scope after
// legal review (Aditi, 27 Nov 2026, Option A).
export function PrivacyRequestPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{
    reference: string;
    status: string;
    type: PrivacyRequestType;
  } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const payload = buildPrivacyRequestPayload({
        email: String(data.get("email") || ""),
        type: String(data.get("type") || ""),
        details: String(data.get("details") || ""),
      });
      const response = await fetch("/api/privacy/requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.reference !== "string")
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Your request could not be filed. Please try again.",
        );
      setSubmitted({
        reference: result.reference,
        status: String(result.status || "SUBMITTED"),
        type: payload.type,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to file request.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    const nextSteps = privacyRequestNextSteps(submitted.status);
    return (
      <div className="renova-experience">
        <ExperienceHeader />
        <main
          id="main-content"
          className="experience-container experience-contact-page"
        >
          <div className="experience-confirmation" role="status">
            <CheckCircle2 size={32} />
            <h3>{nextSteps.heading}</h3>
            <p>
              Reference: <strong>{submitted.reference}</strong>. Keep this for
              your records.
            </p>
            <p>{nextSteps.body}</p>
            <p>
              Your account stays usable while the team reviews the request.
              Erasure, where it applies, happens only after legal review —
              nothing is deleted by filing this request.
            </p>
            <button
              className="experience-button"
              onClick={() => setSubmitted(null)}
            >
              File another request
            </button>{" "}
            <Link href="/privacy">Back to privacy information</Link>
          </div>
        </main>
        <ExperienceFooter />
      </div>
    );
  }

  return (
    <div className="renova-experience">
      <ExperienceHeader />
      <main
        id="main-content"
        className="experience-container experience-contact-page"
      >
        <span className="experience-eyebrow">PRIVACY REQUEST</span>
        <h1>File a privacy request</h1>
        <p>
          Ask NIRMAQ to show, correct or delete the personal data it holds about
          you. Your request goes to the NIRMAQ team for review — the team
          confirms what can be done after legal review.
        </p>
        <form className="experience-contact-form" onSubmit={submit}>
          <div className="experience-form-row">
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                maxLength={320}
                autoComplete="email"
              />
            </label>
          </div>
          <fieldset className="experience-form-row">
            <legend>Request type</legend>
            {PRIVACY_REQUEST_TYPES.map((type) => (
              <label key={type}>
                <input
                  type="radio"
                  name="type"
                  value={type}
                  required
                  defaultChecked={type === "ACCESS"}
                />{" "}
                {PRIVACY_REQUEST_TYPE_LABELS[type]}
              </label>
            ))}
          </fieldset>
          <div className="experience-form-row">
            <label>
              Details (optional)
              <textarea
                name="details"
                rows={4}
                minLength={2}
                maxLength={2000}
                placeholder="What should the team know about your request?"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="live-error">
              {error}
            </p>
          )}
          <p className="live-note">
            If you are not signed in, we email you a verification link before
            the request is reviewed. Filing a deletion request does not delete
            anything by itself: the team reviews it, legal, financial or
            security holds can pause it, and erasure happens out of band only
            after legal review.
          </p>
          <button className="experience-button" disabled={busy} type="submit">
            {busy ? "Filing…" : "File privacy request"}
          </button>
        </form>
        <p>
          <Link href="/privacy">Back to privacy information</Link>
        </p>
      </main>
      <ExperienceFooter />
    </div>
  );
}
