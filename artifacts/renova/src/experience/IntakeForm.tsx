import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Printer,
} from "lucide-react";
import { ExperienceFooter, ExperienceHeader } from "./Header";
import {
  assessIntakeBand,
  buildIntakeEnquiryDetails,
  DOCUMENT_OPTIONS,
  EMPTY_INTAKE_FORM,
  EXTRA_AREA_OPTIONS,
  LAND_OWNERSHIP_LABELS,
  PARKING_LABELS,
  ROAD_RESERVATION_LABELS,
  ROAD_WIDTH_LABELS,
  validateIntakeForm,
} from "./intake-form";
import type {
  IntakeFormValues,
  LandOwnership,
  ParkingRequirement,
  PlotUnit,
  RoadReservation,
  RoadWidth,
} from "./intake-form";
import { TENTATIVE_FEASIBILITY_DISCLAIMER } from "./tentative-feasibility";
import type { TentativeFeasibilityResult } from "./tentative-feasibility";
import { sendRequirementEnquiry } from "./requirement-enquiry";

/**
 * Society Redevelopment Intake Form (/societies/intake-form).
 *
 * The 15-field plain-English intake any co-operative housing society can
 * fill in under 5 minutes without an architect — on the website, or
 * printed for a Managing Committee meeting (print stylesheet in
 * experience.css). Submitting sends it through the existing requirement
 * enquiry pipeline (frontend → API → PostgreSQL → admin); a failed save
 * is shown honestly, never as a fake success.
 *
 * On a successful save, the confirmation shows the tentative indication
 * band computed from the four numbers (plot area, flat count, total
 * carpet, local selling rate) — band only, no figures. The maximum
 * viable extra area is deliberately NOT computed here: it is worked out
 * in the detailed study, with real costs and premiums.
 */

type ChoiceOption<T extends string> = { value: T; label: string };

function ChoiceGroup<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: Array<ChoiceOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p>
        <strong>{label}</strong>
        {hint ? ` — ${hint}` : ""}
      </p>
      <div
        className="experience-dcpr-grid"
        role="group"
        aria-label={label}
      >
        {options.map((item) => (
          <button
            key={item.value}
            type="button"
            className="experience-dcpr-card experience-scheme-card"
            aria-pressed={value === item.value}
            onClick={() => onChange(item.value)}
          >
            <h3>{item.label}</h3>
          </button>
        ))}
      </div>
    </div>
  );
}

export function IntakeFormPage() {
  const [values, setValues] = useState<IntakeFormValues>(EMPTY_INTAKE_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    reference: string;
    band: TentativeFeasibilityResult | null;
  } | null>(null);

  function setField<K extends keyof IntakeFormValues>(
    key: K,
    value: IntakeFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleDocument(id: string) {
    setValues((current) => ({
      ...current,
      documents: current.documents.includes(id)
        ? current.documents.filter((item) => item !== id)
        : [...current.documents, id],
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validateIntakeForm(values);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setSubmitError(null);
      return;
    }
    setErrors([]);
    setSubmitError(null);
    setSubmitting(true);
    try {
      const reference = await sendRequirementEnquiry(
        buildIntakeEnquiryDetails(values),
      );
      setSubmitted({ reference, band: assessIntakeBand(values) });
    } catch (cause) {
      setSubmitError(
        cause instanceof Error
          ? `Your form was not submitted. ${cause.message} If this keeps happening, email the details directly to info@nirmaq.in.`
          : "Your form was not submitted. Submissions are temporarily unavailable — please try again later, or email the details directly to info@nirmaq.in.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartAgain() {
    setValues(EMPTY_INTAKE_FORM);
    setErrors([]);
    setSubmitError(null);
    setSubmitted(null);
  }

  return (
    <div className="renova-experience">
      <ExperienceHeader />
      <main
        id="main-content"
        className="experience-container experience-info-page"
      >
        <div className="print-only">
          <h1>NIRMAQ.IN — Society Redevelopment Intake Form</h1>
          <p>
            For the Managing Committee — fill in by hand, or complete online
            at nirmaq.in/societies/intake-form.
          </p>
        </div>
        <span className="experience-eyebrow no-print">
          For housing societies · Redevelopment intake form
        </span>
        <h1 className="no-print">
          Tell us about your building — in plain English.
        </h1>
        <p className="no-print">
          Fifteen short fields, under five minutes, no architect needed. The
          NIRMAQ team uses your answers to prepare your tentative feasibility
          indication and to start the detailed study with you. Nothing here
          is a promise of area, FSI or returns — the detailed study is where
          real numbers are worked out.
        </p>
        <p className="no-print">
          <button
            type="button"
            className="experience-button"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            Print this form for your committee
          </button>
        </p>

        {submitted ? (
          <div className="experience-confirmation" role="status">
            <CheckCircle2 size={32} />
            <h3>Your intake form is with NIRMAQ.</h3>
            <p>
              Reference: <strong>{submitted.reference}</strong>. Keep this
              for your records — the NIRMAQ team will review your details
              and be in touch.
            </p>
            {submitted.band ? (
              <div
                className={`experience-tentative-result experience-tentative-result--${submitted.band.band}`}
              >
                <ClipboardCheck size={26} />
                <span className="experience-eyebrow">
                  Tentative indication — from the four numbers in your form
                </span>
                <h3>{submitted.band.bandLabel}</h3>
                <ul>
                  {submitted.band.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="experience-tentative-disclaimer">
                  {TENTATIVE_FEASIBILITY_DISCLAIMER}
                </p>
              </div>
            ) : (
              <p>
                The team will work out your tentative indication once the
                area details are shared with them.
              </p>
            )}
            <p>
              The maximum extra area your members can be offered is worked
              out in the detailed study, with real costs and premiums — this
              form gives the team the starting facts, not the answer.
            </p>
            <p className="no-print">
              <button
                type="button"
                className="experience-button"
                onClick={handleStartAgain}
              >
                Fill in another society&rsquo;s form
                <ArrowRight size={16} />
              </button>{" "}
              <Link href="/">Back to NIRMAQ home →</Link>
            </p>
          </div>
        ) : (
          <form
            className="experience-intake-form"
            onSubmit={handleSubmit}
            noValidate
          >
            {errors.length > 0 && (
              <div className="experience-error" role="alert">
                <strong>Please fix the following:</strong>
                <ul>
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <section className="experience-tentative-card">
              <h2>1. Society identity &amp; location</h2>
              <label>
                Name of Co-operative Housing Society
                <input
                  type="text"
                  placeholder="e.g. Malvani Virgo Co-op Housing Society Ltd."
                  value={values.societyName}
                  onChange={(event) =>
                    setField("societyName", event.target.value)
                  }
                />
              </label>
              <div className="experience-form-row">
                <label>
                  Society Registration Number &amp; Year
                  <input
                    type="text"
                    placeholder="From your Society Registration Certificate"
                    value={values.registrationNumber}
                    onChange={(event) =>
                      setField("registrationNumber", event.target.value)
                    }
                  />
                </label>
                <label>
                  Municipal Ward &amp; Village / CTS No.
                  <input
                    type="text"
                    placeholder="e.g. P/N Ward, Village Malvani, CTS No. 8-A — from Property Card"
                    value={values.wardCts}
                    onChange={(event) =>
                      setField("wardCts", event.target.value)
                    }
                  />
                </label>
              </div>
              <label>
                Full Site Address &amp; Pin Code
                <input
                  type="text"
                  placeholder="Building Name, Street/Road, Suburb, Mumbai"
                  value={values.address}
                  onChange={(event) =>
                    setField("address", event.target.value)
                  }
                />
              </label>
              <ChoiceGroup<LandOwnership>
                label="Land Ownership Type"
                options={(
                  Object.keys(LAND_OWNERSHIP_LABELS) as Array<
                    Exclude<LandOwnership, "">
                  >
                ).map((key) => ({
                  value: key,
                  label: LAND_OWNERSHIP_LABELS[key],
                }))}
                value={values.landOwnership}
                onChange={(value) => setField("landOwnership", value)}
              />
            </section>

            <section className="experience-tentative-card">
              <h2>2. Plot &amp; road access details</h2>
              <div className="experience-form-row">
                <label>
                  Total Plot Area
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="As per Property Card / Conveyance Deed"
                    value={values.plotArea}
                    onChange={(event) =>
                      setField("plotArea", event.target.value)
                    }
                  />
                </label>
                <label>
                  Area unit
                  <select
                    value={values.plotUnit}
                    onChange={(event) =>
                      setField("plotUnit", event.target.value as PlotUnit)
                    }
                  >
                    <option value="sqm">Sq. Mtrs</option>
                    <option value="sqft">Sq. Ft.</option>
                  </select>
                </label>
              </div>
              <ChoiceGroup<RoadWidth>
                label="Width of Road Touching the Plot"
                hint="determines maximum FSI"
                options={(
                  Object.keys(ROAD_WIDTH_LABELS) as Array<
                    Exclude<RoadWidth, "">
                  >
                ).map((key) => ({
                  value: key,
                  label: ROAD_WIDTH_LABELS[key],
                }))}
                value={values.roadWidth}
                onChange={(value) => setField("roadWidth", value)}
              />
              <ChoiceGroup<RoadReservation>
                label="Any Road Widening / Reservation on Plot?"
                options={(
                  Object.keys(ROAD_RESERVATION_LABELS) as Array<
                    Exclude<RoadReservation, "">
                  >
                ).map((key) => ({
                  value: key,
                  label: ROAD_RESERVATION_LABELS[key],
                }))}
                value={values.roadReservation}
                onChange={(value) => setField("roadReservation", value)}
              />
            </section>

            <section className="experience-tentative-card">
              <h2>3. Existing building &amp; member details</h2>
              <div className="experience-form-row">
                <label>
                  Building Age (years)
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 35"
                    value={values.buildingAge}
                    onChange={(event) =>
                      setField("buildingAge", event.target.value)
                    }
                  />
                </label>
                <label>
                  Structure Type
                  <input
                    type="text"
                    placeholder="e.g. Ground + 4 Floors, RCC"
                    value={values.structureType}
                    onChange={(event) =>
                      setField("structureType", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="experience-form-row">
                <label>
                  Total Residential Flats
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Number of flats"
                    value={values.residentialFlats}
                    onChange={(event) =>
                      setField("residentialFlats", event.target.value)
                    }
                  />
                </label>
                <label>
                  Total Commercial Shops / Offices
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter 0 if purely residential"
                    value={values.commercialUnits}
                    onChange={(event) =>
                      setField("commercialUnits", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="experience-form-row">
                <label>
                  Total Existing Carpet Area of All Flats (Sq. Ft.)
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="As per MCGM Occupation Certificate / Society Share Register"
                    value={values.totalCarpet}
                    onChange={(event) =>
                      setField("totalCarpet", event.target.value)
                    }
                  />
                </label>
                <label>
                  Average Flat Carpet Area — Approximate (Sq. Ft.)
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 1 BHK = 350 sq. ft., 2 BHK = 550 sq. ft."
                    value={values.avgCarpet}
                    onChange={(event) =>
                      setField("avgCarpet", event.target.value)
                    }
                  />
                </label>
              </div>
            </section>

            <section className="experience-tentative-card">
              <h2>4. Society expectations — what members want</h2>
              <ChoiceGroup<string>
                label="Expected Extra Carpet Area"
                options={EXTRA_AREA_OPTIONS.map((pct) => ({
                  value: pct,
                  label: pct === "30" ? "30% or more" : `${pct}%`,
                }))}
                value={values.extraAreaPct}
                onChange={(value) => setField("extraAreaPct", value)}
              />
              <div className="experience-form-row">
                <label>
                  Expected Hardship Corpus (₹ per sq. ft.)
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="₹ per sq. ft."
                    value={values.corpusPerSqft}
                    onChange={(event) =>
                      setField("corpusPerSqft", event.target.value)
                    }
                  />
                </label>
                <label>
                  Current Local Rent in Area (₹ per sq. ft. / month)
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="₹ per sq. ft."
                    value={values.rentPerSqft}
                    onChange={(event) =>
                      setField("rentPerSqft", event.target.value)
                    }
                  />
                </label>
              </div>
              <ChoiceGroup<ParkingRequirement>
                label="Car Parking Requirement"
                options={(
                  Object.keys(PARKING_LABELS) as Array<
                    Exclude<ParkingRequirement, "">
                  >
                ).map((key) => ({
                  value: key,
                  label:
                    key === "covered"
                      ? "1 Covered Parking per Flat"
                      : "Stack Parking Acceptable",
                }))}
                value={values.parking}
                onChange={(value) => setField("parking", value)}
              />
              <label>
                Expected New Flat Selling Price in Area (₹ per sq. ft.)
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Current market rate of new towers nearby"
                  value={values.sellingPrice}
                  onChange={(event) =>
                    setField("sellingPrice", event.target.value)
                  }
                />
              </label>
            </section>

            <section className="experience-tentative-card">
              <h2>5. Document readiness checklist</h2>
              <p>
                Tick the documents your society already has ready. Missing
                ones are fine — the team will tell you what to arrange.
              </p>
              {DOCUMENT_OPTIONS.map((doc) => (
                <label key={doc.id} className="experience-consent">
                  <input
                    type="checkbox"
                    checked={values.documents.includes(doc.id)}
                    onChange={() => toggleDocument(doc.id)}
                  />
                  {doc.label}
                </label>
              ))}
            </section>

            <section className="experience-tentative-card">
              <h2>6. Your contact — so we can reply</h2>
              <div className="experience-form-row">
                <label>
                  Committee Contact Name
                  <input
                    type="text"
                    placeholder="e.g. Secretary / Chairman"
                    value={values.contactName}
                    onChange={(event) =>
                      setField("contactName", event.target.value)
                    }
                  />
                </label>
                <label>
                  Role in the Society
                  <input
                    type="text"
                    placeholder="e.g. Secretary, Chairman, Committee Member"
                    value={values.contactRole}
                    onChange={(event) =>
                      setField("contactRole", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="experience-form-row">
                <label>
                  Phone
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder="Committee contact phone"
                    value={values.contactPhone}
                    onChange={(event) =>
                      setField("contactPhone", event.target.value)
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="Committee contact email"
                    value={values.contactEmail}
                    onChange={(event) =>
                      setField("contactEmail", event.target.value)
                    }
                  />
                </label>
              </div>
              <label className="experience-consent">
                <input
                  type="checkbox"
                  checked={values.consent}
                  onChange={(event) =>
                    setField("consent", event.target.checked)
                  }
                />
                I agree NIRMAQ may contact our society about this enquiry.
              </label>
            </section>

            {submitError && (
              <p className="experience-error" role="alert">
                {submitError}
              </p>
            )}
            <button
              type="submit"
              className="experience-button no-print"
              disabled={submitting}
            >
              {submitting ? "Sending…" : "Send to NIRMAQ"}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </main>
      <ExperienceFooter />
    </div>
  );
}
