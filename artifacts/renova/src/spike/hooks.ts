import { useEffect, useRef, useState } from "react";

/** 0→1 progress of a tall section travelling through the viewport. */
export function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const total = el.offsetHeight - window.innerHeight;
        const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
        progressRef.current = p;
        setProgress(p);
      }
      raf = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
  return { progress, progressRef };
}

/** Live FPS + average frame time, sampled twice a second while active. */
export function useFpsMeter(active: boolean) {
  const [sample, setSample] = useState<{ fps: number; ms: number } | null>(null);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    let windowStart = last;
    const loop = (now: number) => {
      frames += 1;
      last = now;
      if (now - windowStart >= 500) {
        const elapsed = now - windowStart;
        setSample({
          fps: Math.round((frames * 1000) / elapsed),
          ms: Math.round((elapsed / frames) * 10) / 10,
        });
        frames = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return sample;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Clamp a value into a 0→1 segment between a and b. */
export function seg(p: number, a: number, b: number) {
  if (b <= a) return p >= b ? 1 : 0;
  return Math.min(1, Math.max(0, (p - a) / (b - a)));
}
