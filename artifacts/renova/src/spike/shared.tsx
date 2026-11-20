export const STAGES = [
  { kicker: "Stage 1 — The existing building", text: "Every redevelopment journey starts with an existing reality." },
  { kicker: "Stage 2 — Understanding the potential", text: "Understanding what is possible." },
  { kicker: "Stage 3 — The transformation", text: "Connecting the right people to move forward." },
  { kicker: "Stage 4 — The future", text: "Every building has a future." },
] as const;

export function stageIndex(progress: number) {
  if (progress < 0.25) return 0;
  if (progress < 0.5) return 1;
  if (progress < 0.75) return 2;
  return 3;
}

/**
 * Hero copy from Aditi's mockup. CTA targets use only routes verified in
 * App.tsx by the Phase 1 audit: "Explore Your Redevelopment" → /societies
 * (no dedicated feasibility route exists; the feasibility view is login-gated
 * and registration is closed). "Discover How It Works" advances the scroll
 * transformation on this page instead of implying a video.
 */
export function HeroCopy({ visible, onDiscover }: { visible: boolean; onDiscover: () => void }) {
  return (
    <div
      className="s0-hero-copy"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.45s ease", pointerEvents: visible ? "auto" : "none" }}
      aria-hidden={!visible}
    >
      <p className="s0-eyebrow">Redevelopment, Reimagined</p>
      <h1 className="s0-h1">
        Redevelopment,
        <br />
        <span className="s0-plum-word">
          <em>Reimagined.</em>
        </span>
      </h1>
      <p className="s0-sub">A smarter, simpler way to navigate redevelopment in Mumbai.</p>
      <div className="s0-ctas">
        <a className="s0-cta-primary" href="/societies">
          Explore Your Redevelopment
        </a>
        <button type="button" className="s0-cta-secondary" onClick={onDiscover}>
          <span className="s0-cta-play" aria-hidden="true">
            ▶
          </span>
          Discover How It Works
        </button>
      </div>
    </div>
  );
}

export function StageCaption({ progress }: { progress: number }) {
  const idx = stageIndex(progress);
  return (
    <>
      {STAGES.map((stage, i) => (
        <div
          key={stage.kicker}
          className="s0-caption"
          style={{ opacity: i === idx && progress > 0.06 ? 1 : 0, transition: "opacity 0.4s ease" }}
          aria-hidden={i !== idx}
        >
          <p className="s0-stage-kicker">{stage.kicker}</p>
          <p>{stage.text}</p>
        </div>
      ))}
    </>
  );
}

export function StakeBar() {
  return (
    <nav className="s0-stakebar" aria-label="Who NIRMAQ is for">
      <a href="/societies">Housing Societies</a>
      <a href="/developers">Developers</a>
      <a href="/professionals/pmcs">PMCs</a>
      <a href="/professionals">Professionals</a>
    </nav>
  );
}

export function StaticCaptions() {
  return (
    <div className="s0-static-captions">
      <h2>The transformation, in four stages</h2>
      <ol>
        {STAGES.map((s) => (
          <li key={s.kicker}>
            <strong>{s.kicker}:</strong> {s.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
