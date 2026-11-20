import { Suspense, lazy, useState } from "react";
import "./stage0.css";

const VariantThree = lazy(() => import("./VariantThree"));
const VariantLayered = lazy(() => import("./VariantLayered"));

type Variant = "A" | "B";

/**
 * Option C (hybrid) runtime rule, demonstrated live by the "Auto" button:
 * real 3D only on desktop-class, motion-allowed, WebGL-capable devices;
 * the layered scene everywhere else.
 */
function hybridDecision(): { variant: Variant; reason: string } {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return { variant: "B", reason: "prefers-reduced-motion → layered (static) experience" };
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    webgl = false;
  }
  if (!webgl) return { variant: "B", reason: "WebGL unavailable → layered scene" };
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return { variant: "B", reason: "Save-Data enabled → layered scene" };
  if (window.innerWidth < 768)
    return { variant: "B", reason: `small viewport (${window.innerWidth}px wide) → layered scene` };
  const cores = navigator.hardwareConcurrency ?? 8;
  if (cores <= 4) return { variant: "B", reason: `low-power CPU (${cores} cores) → layered scene` };
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem <= 4)
    return { variant: "B", reason: `low device memory (${mem} GB) → layered scene` };
  return {
    variant: "A",
    reason: `desktop-class device (${cores} cores${mem ? `, ${mem} GB RAM` : ""}, WebGL available, motion allowed) → real 3D`,
  };
}

export default function Stage0Spike() {
  const [variant, setVariant] = useState<Variant>("A");
  const [autoReason, setAutoReason] = useState<string | null>(null);

  const choose = (v: Variant) => {
    setAutoReason(null);
    setVariant(v);
    window.scrollTo({ top: 0 });
  };
  const chooseAuto = () => {
    const d = hybridDecision();
    setVariant(d.variant);
    setAutoReason(`Hybrid rule picked Variant ${d.variant}: ${d.reason}.`);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="s0-page">
      <header className="s0-topbar">
        <a className="s0-wordmark" href="/">
          NIRMAQ
        </a>
        <span className="s0-spike-badge">Stage 0 design spike — not the live homepage</span>
        <nav className="s0-topnav" aria-label="Spike navigation">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/societies">For Societies</a>
          <a href="/developers">For Developers</a>
          <a href="/professionals">For Professionals</a>
          <a className="s0-login" href="/platform/live?mode=login">
            Log in
          </a>
        </nav>
      </header>

      <div className="s0-switcher" role="group" aria-label="Compare spike variants">
        <strong>Compare:</strong>
        <button type="button" className="s0-switch-btn" aria-pressed={variant === "A" && !autoReason} onClick={() => choose("A")}>
          Variant A — Real 3D (Three.js)
        </button>
        <button type="button" className="s0-switch-btn" aria-pressed={variant === "B" && !autoReason} onClick={() => choose("B")}>
          Variant B — Layered scene (2.5D)
        </button>
        <button type="button" className="s0-switch-btn" aria-pressed={!!autoReason} onClick={chooseAuto}>
          Auto — Hybrid rule (Option C)
        </button>
        <span className="s0-switch-note">
          {autoReason ??
            "Spike route only — the live homepage is unchanged. Registration stays closed; CTAs use existing public routes only."}
        </span>
      </div>

      <Suspense fallback={<div style={{ padding: 60, textAlign: "center" }}>Loading variant…</div>}>
        {variant === "A" ? <VariantThree key="A" /> : <VariantLayered key="B" />}
      </Suspense>

      <section className="s0-notes" id="s0-notes">
        <h2>Stage 0 spike — what you are looking at</h2>
        <p>
          This page exists only to compare two ways of building the new NIRMAQ hero, on evidence, before any
          homepage work is approved. It is an additive route (<code>/spike/homepage-stage0</code>); the live
          homepage, the intro video, and every existing route are untouched.
        </p>

        <h3>The two variants</h3>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Variant A — Real 3D</th>
              <th>Variant B — Layered scene</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>What it is</strong>
              </td>
              <td>
                A real-time WebGL scene (Three.js): procedural geometry — weathered old building, blueprint
                wireframe tower that grows into a lit modern tower, skyline, podium, trees — with a
                scroll-driven camera.
              </td>
              <td>
                Pre-rendered artwork from the approved mockup (WebP), split into depth layers with an SVG
                blueprint/wireframe overlay, parallax and stage crossfades driven by scroll (framer-motion).
                This is 2.5D, <strong>not</strong> 3D, and is labelled as such.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Fallbacks</strong>
              </td>
              <td>
                Pixel-ratio cap (1.5 on small screens, 2 on desktop); rendering pauses off-screen; if WebGL is
                unavailable the poster image is shown instead; reduced motion renders one static frame plus
                the four stage captions as text.
              </td>
              <td>
                No WebGL needed at all; reduced motion shows the static composition plus the four stage
                captions as text; the same artwork doubles as the loading poster for Variant A.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Artwork</strong>
              </td>
              <td>Generated in code — no model files, no external assets.</td>
              <td>
                Mockup PNG (2.8 MB) cropped to the scene only (its baked-in text/buttons are not reused) and
                compressed: 127 KB WebP scene + 43 KB foreground band.
              </td>
            </tr>
          </tbody>
        </table>

        <h3>Option C — Hybrid (how the switch would work)</h3>
        <p>
          The “Auto” button above runs the proposed hybrid rule on this device, right now:{" "}
          <strong>real 3D only when</strong> the viewport is desktop-width (≥768px), WebGL is available, the CPU
          reports more than 4 cores, device memory (where exposed) is above 4 GB, Save-Data is off, and the
          visitor has not requested reduced motion. <strong>Otherwise the layered scene</strong> — including all
          reduced-motion visitors, who get the static layered composition with the full text content. The rule
          is evaluated once on load; the other variant’s code is never downloaded.
        </p>

        <h3>Honesty notes</h3>
        <ul>
          <li>Registration is closed, so no button here leads to a signup flow. “Explore Your Redevelopment” goes to the existing public societies page; “Discover How It Works” simply advances the scroll transformation.</li>
          <li>The enquiry form is not presented anywhere in this spike, and nothing here claims it works — its backend is a separate workstream.</li>
          <li>The NIRMAQ logo mark in the mockup is not reproduced: the header uses the existing plain wordmark, as instructed. Logo/favicon are a separate brand decision.</li>
          <li>The intro video is untouched and does not play on this route.</li>
        </ul>
      </section>
    </div>
  );
}
