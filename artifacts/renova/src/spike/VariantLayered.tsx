import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { useFpsMeter, usePrefersReducedMotion } from "./hooks";
import { HeroCopy, StageCaption, StakeBar, StaticCaptions } from "./shared";

/**
 * VARIANT B — layered scroll scene (2.5D). NOT 3D: pre-rendered artwork
 * derived from Aditi's mockup (compressed to WebP), split into a base
 * layer + a foreground band, with an SVG blueprint/wireframe overlay,
 * driven by scroll via framer-motion (already installed). Labelled
 * honestly in the UI as a layered scene.
 */

function BlueprintOverlay() {
  // Coordinates are in the scene-crop frame (viewBox 1004x715): the new
  // tower stands roughly x 201–502, y 19–677 in the cropped artwork.
  const floors = Array.from({ length: 15 }, (_, i) => 60 + i * 41);
  return (
    <svg className="s0-blueprint-svg" viewBox="0 0 1004 715" preserveAspectRatio="none" aria-hidden="true">
      {/* plot boundary */}
      <rect x="117" y="652" width="553" height="56" fill="none" stroke="#8ac8ff" strokeWidth="1.6" strokeDasharray="7 5" />
      {/* tower wireframe */}
      <rect x="201" y="19" width="301" height="658" fill="rgba(70,130,200,0.07)" stroke="#a8dcff" strokeWidth="2.2" />
      {floors.map((y) => (
        <line key={y} x1="201" y1={y} x2="502" y2={y} stroke="#a8dcff" strokeWidth="0.9" opacity="0.75" />
      ))}
      <line x1="201" y1="19" x2="502" y2="677" stroke="#a8dcff" strokeWidth="0.7" opacity="0.5" />
      <line x1="502" y1="19" x2="201" y2="677" stroke="#a8dcff" strokeWidth="0.7" opacity="0.5" />
      {/* measurement ticks + annotation */}
      <line x1="528" y1="19" x2="528" y2="677" stroke="#ffd9a0" strokeWidth="1.2" />
      <line x1="518" y1="19" x2="538" y2="19" stroke="#ffd9a0" strokeWidth="1.2" />
      <line x1="518" y1="677" x2="538" y2="677" stroke="#ffd9a0" strokeWidth="1.2" />
      <text x="546" y="360" fill="#ffd9a0" fontSize="19" fontFamily="DM Mono, monospace">G+15</text>
      <text x="125" y="700" fill="#8ac8ff" fontSize="16" fontFamily="DM Mono, monospace">PLOT BOUNDARY</text>
      <circle cx="351" cy="677" r="6" fill="none" stroke="#ffd9a0" strokeWidth="1.4" />
    </svg>
  );
}

export default function VariantLayered() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [progress, setProgress] = useState(0);
  const [inView, setInView] = useState(true);
  const fps = useFpsMeter(inView && !reduced);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  useMotionValueEvent(scrollYProgress, "change", (v) => setProgress(v));

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.02 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Layer choreography across the four stages
  const backScale = useTransform(scrollYProgress, [0, 1], [1.07, 1.0]);
  const backY = useTransform(scrollYProgress, [0, 1], [0, -14]);
  const backFilter = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    ["saturate(0.82) brightness(0.93)", "saturate(0.95) brightness(0.99)", "saturate(1.06) brightness(1.04)"],
  );
  const frontY = useTransform(scrollYProgress, [0, 1], [0, 14]);
  const blueprintOpacity = useTransform(scrollYProgress, [0.16, 0.32, 0.58, 0.76], [0, 0.95, 0.95, 0]);
  const scanTop = useTransform(scrollYProgress, [0.42, 0.8], ["4%", "92%"]);
  const scanOpacity = useTransform(scrollYProgress, [0.42, 0.5, 0.72, 0.8], [0, 0.9, 0.9, 0]);
  const glowOpacity = useTransform(scrollYProgress, [0.68, 1], [0, 0.5]);

  const scrollBy = () => window.scrollBy({ top: window.innerHeight * 0.85, behavior: "smooth" });

  if (reduced) {
    return (
      <section ref={sectionRef} className="s0-static" aria-label="Variant B — layered scene, reduced motion">
        <div className="s0-static-frame">
          <div className="s0-layer-stage">
            <img className="s0-layer" src="/spike/mockup-scene.webp" alt="NIRMAQ redevelopment scene — old building and new tower at dusk" />
            <img className="s0-layer-front" src="/spike/mockup-front.webp" alt="" aria-hidden="true" />
            <div style={{ opacity: 0.4 }}>
              <BlueprintOverlay />
            </div>
          </div>
          <div className="s0-dusk" />
          <span className="s0-variant-chip">Variant B — Layered scene · 2.5D (not 3D) · static (reduced motion)</span>
          <HeroCopy visible onDiscover={() => document.getElementById("s0-notes")?.scrollIntoView()} />
          <StakeBar />
        </div>
        <StaticCaptions />
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="s0-scroll" aria-label="Variant B — layered scene">
      <div className="s0-sticky">
        <div className="s0-layer-stage">
          <motion.img
            className="s0-layer"
            src="/spike/mockup-scene.webp"
            alt="NIRMAQ redevelopment scene — old building and new tower at dusk"
            style={{ scale: backScale, y: backY, filter: backFilter }}
          />
          {/* warm "future" glow over the tower area in stage 4 */}
          <motion.div
            style={{
              opacity: glowOpacity,
              position: "absolute",
              left: "16%",
              top: "0%",
              width: "38%",
              height: "96%",
              background: "radial-gradient(ellipse at center, rgba(255,178,105,0.5) 0%, rgba(255,178,105,0) 68%)",
              pointerEvents: "none",
            }}
          />
          <motion.div style={{ opacity: blueprintOpacity, position: "absolute", inset: 0 }}>
            <BlueprintOverlay />
          </motion.div>
          {/* scan line sweeping the tower during the transformation stage */}
          <motion.div
            style={{
              top: scanTop,
              opacity: scanOpacity,
              position: "absolute",
              left: "19.5%",
              width: "31%",
              height: 3,
              background: "linear-gradient(90deg, rgba(168,220,255,0), rgba(168,220,255,0.95), rgba(168,220,255,0))",
              pointerEvents: "none",
            }}
          />
          <motion.img
            className="s0-layer-front"
            src="/spike/mockup-front.webp"
            alt=""
            aria-hidden="true"
            style={{ y: frontY }}
          />
        </div>
        <div className="s0-dusk" />
        <span className="s0-variant-chip">Variant B — Layered scene · 2.5D (not 3D) · artwork + SVG overlay</span>
        {fps && <span className="s0-perf">{fps.fps} fps · {fps.ms} ms/frame</span>}
        <HeroCopy visible={progress < 0.1} onDiscover={scrollBy} />
        <StageCaption progress={progress} />
        {progress < 0.06 && <div className="s0-scroll-hint">Scroll to explore ↓</div>}
        <StakeBar />
      </div>
    </section>
  );
}
