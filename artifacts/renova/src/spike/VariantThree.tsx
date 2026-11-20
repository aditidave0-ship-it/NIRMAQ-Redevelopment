import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { seg, useFpsMeter, usePrefersReducedMotion, useScrollProgress } from "./hooks";
import { HeroCopy, StageCaption, StakeBar, StaticCaptions } from "./shared";

/**
 * VARIANT A — real-time 3D (Three.js / WebGL), procedural geometry only.
 * Choice: vanilla three over @react-three/fiber — the scene is a single
 * imperative canvas; vanilla three avoids a second React reconciler and
 * keeps the lazy chunk to three core only.
 */

function makeCanvas(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function oldBuildingTexture() {
  return makeCanvas(256, 512, (g, w, h) => {
    g.fillStyle = "#978a76";
    g.fillRect(0, 0, w, h);
    // weathering streaks
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * w;
      g.fillStyle = `rgba(58,48,38,${0.05 + Math.random() * 0.13})`;
      g.fillRect(x, Math.random() * h * 0.4, 2 + Math.random() * 7, 60 + Math.random() * 220);
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(40,34,26,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
    // windows: 4 cols x 9 rows
    const cols = 4, rows = 9, cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = Math.random() < 0.16;
        g.fillStyle = lit ? "rgba(255,196,120,0.85)" : "#2e3444";
        g.fillRect(c * cw + 11, r * ch + 12, cw - 22, ch - 24);
        g.fillStyle = "rgba(255,255,255,0.10)";
        g.fillRect(c * cw + 11, r * ch + 12, cw - 22, 4);
      }
      // balcony shadow line
      g.fillStyle = "rgba(30,24,18,0.35)";
      g.fillRect(0, (r + 1) * ch - 3, w, 3);
    }
  });
}

function towerFacadeTextures() {
  const windows: Array<[number, number, number, number]> = [];
  const map = makeCanvas(256, 768, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#d3c8b6");
    grad.addColorStop(1, "#b3a68f");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const cols = 5, rows = 16, cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + 8, y = r * ch + 9, ww = cw - 16, hh = ch - 18;
        windows.push([x, y, ww, hh]);
        g.fillStyle = "#3c4c66";
        g.fillRect(x, y, ww, hh);
        g.fillStyle = "rgba(255,255,255,0.16)";
        g.fillRect(x, y, ww, 5);
      }
    }
    g.fillStyle = "rgba(90,78,60,0.5)";
    for (let c = 1; c < cols; c++) g.fillRect(c * cw - 1, 0, 2, h);
  });
  const emissive = makeCanvas(256, 768, (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    for (const [x, y, ww, hh] of windows) {
      if (Math.random() < 0.4) {
        g.fillStyle = Math.random() < 0.5 ? "#ffb36b" : "#ffd9a0";
        g.fillRect(x, y, ww, hh);
      }
    }
  });
  return { map, emissive };
}

function skylineTexture() {
  return makeCanvas(128, 256, (g, w, h) => {
    g.fillStyle = "#263258";
    g.fillRect(0, 0, w, h);
    for (let r = 0; r < 18; r++)
      for (let c = 0; c < 7; c++)
        if (Math.random() < 0.3) {
          g.fillStyle = Math.random() < 0.6 ? "#e8a95e" : "#cfd8ea";
          g.fillRect(c * 18 + 5, r * 14 + 4, 7, 6);
        }
  });
}

function skyTexture() {
  return makeCanvas(16, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#141f3c");
    grad.addColorStop(0.42, "#3c2c50");
    grad.addColorStop(0.68, "#7c4a63");
    grad.addColorStop(0.86, "#c98a68");
    grad.addColorStop(1, "#e0aa7c");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function blueprintGridTexture() {
  const tex = makeCanvas(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "rgba(140,200,255,0.55)";
    g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo((i * w) / 4, 0); g.lineTo((i * w) / 4, h); g.stroke();
      g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 6);
  return tex;
}

export default function VariantThree() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { progress, progressRef } = useScrollProgress(sectionRef);
  const reduced = usePrefersReducedMotion();
  const [inView, setInView] = useState(true);
  const [webglFailed, setWebglFailed] = useState(false);
  const fps = useFpsMeter(inView && !reduced && !webglFailed);
  const inViewRef = useRef(true);
  useEffect(() => {
    inViewRef.current = inView;
  }, [inView]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.02 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setWebglFailed(true);
      return;
    }
    const smallScreen = window.innerWidth < 768;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallScreen ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x2a2c4c, 46, 118);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);

    // Sky backdrop
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(280, 110),
      new THREE.MeshBasicMaterial({ map: skyTexture(), fog: false }),
    );
    sky.position.set(0, 30, -62);
    scene.add(sky);

    // Lights
    scene.add(new THREE.HemisphereLight(0xcfd4ff, 0x574433, 0.85));
    const sun = new THREE.DirectionalLight(0xffd9a0, 1.15);
    sun.position.set(20, 26, 14);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8fb0ff, 0.3);
    fill.position.set(-16, 12, 20);
    scene.add(fill);

    // Ground (Lambert materials throughout the set dressing — cheaper than
    // Standard under software/low-end rendering; the tower keeps Standard)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 320),
      new THREE.MeshLambertMaterial({ color: 0x27304a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    // ---- Old building (front-left) ----
    const oldGroup = new THREE.Group();
    oldGroup.position.set(-7.4, 0, 3.2);
    oldGroup.rotation.y = 0.14;
    const oldFacade = new THREE.MeshLambertMaterial({
      map: oldBuildingTexture(),
      transparent: true,
    });
    const oldTrim = new THREE.MeshLambertMaterial({ color: 0x7d7263, transparent: true });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(7, 11, 5), oldFacade);
    slab.position.y = 5.5;
    oldGroup.add(slab);
    for (let f = 0; f < 7; f++) {
      const balcony = new THREE.Mesh(new THREE.BoxGeometry(7.06, 0.16, 0.72), oldTrim);
      balcony.position.set(0, 1.6 + f * 1.42, 2.78);
      oldGroup.add(balcony);
    }
    for (const dx of [-2.2, 2.0]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.3, 14), oldTrim);
      tank.position.set(dx, 11.65, 0.4);
      oldGroup.add(tank);
    }
    scene.add(oldGroup);

    // ---- New tower (back-right) ----
    const towerGroup = new THREE.Group();
    towerGroup.position.set(6.9, 0, -3.6);
    scene.add(towerGroup);
    const podiumMesh = new THREE.Mesh(
      new THREE.BoxGeometry(11, 1.6, 8.6),
      new THREE.MeshLambertMaterial({ color: 0xc9b294 }),
    );
    podiumMesh.position.y = 0.8;
    towerGroup.add(podiumMesh);

    const TOWER_H = 19;
    const towerGeo = new THREE.BoxGeometry(6.4, TOWER_H, 5.6);
    towerGeo.translate(0, TOWER_H / 2, 0);
    const { map: towerMap, emissive: towerEmissive } = towerFacadeTextures();
    const solidMat = new THREE.MeshStandardMaterial({
      map: towerMap,
      emissiveMap: towerEmissive,
      emissive: new THREE.Color(0xffc98a),
      emissiveIntensity: 0.3,
      roughness: 0.6,
      transparent: true,
      opacity: 0,
    });
    const solidPivot = new THREE.Group();
    solidPivot.position.y = 1.6;
    const solidMesh = new THREE.Mesh(towerGeo, solidMat);
    solidPivot.add(solidMesh);
    solidPivot.scale.y = 0.04;
    towerGroup.add(solidPivot);

    // Wireframe tower: edges + floor lines
    const wireGroup = new THREE.Group();
    wireGroup.position.y = 1.6;
    const wireMat = new THREE.LineBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0 });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(towerGeo), wireMat);
    wireGroup.add(edges);
    const floorPts: number[] = [];
    for (let f = 1; f < 13; f++) {
      const y = (f * TOWER_H) / 13;
      floorPts.push(-3.2, y, 2.81, 3.2, y, 2.81, -3.2, y, -2.81, 3.2, y, -2.81);
    }
    const floorGeo = new THREE.BufferGeometry();
    floorGeo.setAttribute("position", new THREE.Float32BufferAttribute(floorPts, 3));
    wireGroup.add(new THREE.LineSegments(floorGeo, wireMat));
    towerGroup.add(wireGroup);

    // Blueprint grid plane behind the tower front face
    const gridMat = new THREE.MeshBasicMaterial({
      map: blueprintGridTexture(),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(9.5, TOWER_H + 3), gridMat);
    grid.position.set(0, TOWER_H / 2 + 1.4, 3.4);
    towerGroup.add(grid);

    // Plot boundary lines on the ground
    const boundaryPts = [
      new THREE.Vector3(-6.2, 0.03, -5.2),
      new THREE.Vector3(6.2, 0.03, -5.2),
      new THREE.Vector3(6.2, 0.03, 5.2),
      new THREE.Vector3(-6.2, 0.03, 5.2),
    ];
    const boundaryMat = new THREE.LineBasicMaterial({ color: 0x8ac8ff, transparent: true, opacity: 0 });
    const boundary = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(boundaryPts), boundaryMat);
    boundary.position.set(6.9, 0, -3.6);
    scene.add(boundary);

    // ---- Skyline silhouettes (single textured material) ----
    const skylineMat = new THREE.MeshBasicMaterial({ map: skylineTexture() });
    const skyline = new THREE.Group();
    const rng = [0.42, 0.87, 0.13, 0.68, 0.29, 0.95, 0.51, 0.76, 0.08, 0.6, 0.34, 0.99, 0.21, 0.55];
    for (let i = 0; i < 14; i++) {
      const hgt = 8 + rng[i] * 20;
      const wid = 3.4 + rng[(i + 5) % 14] * 3.4;
      const x = -46 + i * 7.1 + rng[(i + 3) % 14] * 3;
      const box = new THREE.Mesh(new THREE.BoxGeometry(wid, hgt, 3), skylineMat);
      box.position.set(x, hgt / 2, -30 - rng[(i + 7) % 14] * 12);
      skyline.add(box);
    }
    scene.add(skyline);

    // ---- Trees ----
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3a28 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x356045 });
    const treeSpots: Array<[number, number, number, number]> = [
      [-13.5, 6.5, 0.92, 0], [-3.4, 8.6, 0.72, 0], [13.8, 5.4, 0.84, 0], [15.6, -0.5, 0.64, 0],
      [1.8, 1.9, 0.6, 1], [11.9, 1.9, 0.55, 1], [-11.8, -1.5, 0.76, 0], [5.2, 12.6, 0.8, 0],
    ];
    for (const [x, z, s, onPodium] of treeSpots) {
      const tree = new THREE.Group();
      const baseY = onPodium ? 1.6 : 0;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.6 * s, 8), trunkMat);
      trunk.position.y = baseY + 0.8 * s;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45 * s, 1), leafMat);
      crown.position.y = baseY + (1.6 + 1.15) * s;
      tree.add(trunk, crown);
      tree.position.set(x, 0, z);
      scene.add(tree);
    }

    let distScale = 1;
    const fit = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      // Portrait screens: widen FOV and pull back so both buildings frame
      camera.fov = camera.aspect < 0.8 ? 58 : camera.aspect < 1.2 ? 50 : 42;
      distScale = camera.aspect < 0.8 ? 1.55 : camera.aspect < 1.2 ? 1.2 : 1;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(mount);

    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
    let smoothed = reduced ? 0.92 : 0;
    let raf = 0;
    const clock = new THREE.Clock();

    const applyProgress = (p: number, t: number) => {
      // Old building: present, then fades + settles as the tower completes
      const oldOut = seg(p, 0.52, 0.78);
      oldFacade.opacity = 1 - oldOut;
      oldTrim.opacity = 1 - oldOut;
      oldGroup.position.y = -0.7 * oldOut;
      oldGroup.visible = oldOut < 0.99;
      // Wireframe + blueprint: in during "understanding", out as solid forms
      const wireIn = seg(p, 0.18, 0.34);
      const wireOut = seg(p, 0.55, 0.78);
      wireMat.opacity = 0.95 * wireIn * (1 - wireOut);
      wireGroup.visible = wireMat.opacity > 0.01;
      gridMat.opacity = 0.55 * seg(p, 0.22, 0.38) * (1 - seg(p, 0.6, 0.8));
      boundaryMat.opacity = 0.9 * seg(p, 0.2, 0.36) * (1 - seg(p, 0.62, 0.82));
      // Solid tower grows floor by floor, then lights up
      const grow = easeOut(seg(p, 0.42, 0.84));
      solidPivot.scale.y = Math.max(0.04, grow);
      solidMat.opacity = seg(p, 0.46, 0.64);
      solidPivot.visible = solidMat.opacity > 0.01;
      solidMat.emissiveIntensity = 0.25 + 0.7 * seg(p, 0.7, 1);
      sun.intensity = 1.15 + 0.35 * seg(p, 0.7, 1);
      // Camera: slow drift + scroll dolly (framed so the full tower fits)
      const camX = 2.2 * p + Math.sin(t * 0.11) * 0.55;
      const camY = 7.2 - 1.2 * p + Math.sin(t * 0.07) * 0.28 + (distScale - 1) * 2.2;
      const camZ = (33 - 2.6 * p) * distScale;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(0.4, 8.8, 0);
    };

    if (reduced) {
      applyProgress(0.92, 0);
      renderer.render(scene, camera);
    } else {
      // Adaptive quality: if frames stay slow, step the pixel ratio down
      // (2 → 1.5 → 1.25 → 1) instead of dropping the scene. Diagnostics are
      // published on window.__s0 for the Stage 0 measurement harness.
      const ratioSteps = [2, 1.5, 1.25, 1];
      const initialRatio = Math.min(window.devicePixelRatio || 1, smallScreen ? 1.5 : 2);
      let ratioIdx = ratioSteps.findIndex((r) => r <= initialRatio + 0.001);
      if (ratioIdx < 0) ratioIdx = ratioSteps.length - 1;
      let frameCount = 0;
      let frameTimeTotal = 0;
      let lastFrameAt = performance.now();
      const diag = window as unknown as Record<string, unknown>;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!inViewRef.current) return;
        const now = performance.now();
        frameTimeTotal += now - lastFrameAt;
        lastFrameAt = now;
        frameCount += 1;
        if (frameCount >= 90) {
          const avg = frameTimeTotal / frameCount;
          if (avg > 30 && ratioIdx < ratioSteps.length - 1) {
            ratioIdx += 1;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioSteps[ratioIdx]));
            fit();
          }
          frameCount = 0;
          frameTimeTotal = 0;
        }
        const target = progressRef.current;
        smoothed += (target - smoothed) * 0.085;
        if (Math.abs(target - smoothed) < 0.0004) smoothed = target;
        diag.__s0 = { progress: smoothed, pixelRatio: renderer.getPixelRatio() };
        applyProgress(smoothed, clock.getElapsedTime());
        renderer.render(scene, camera);
      };
      loop();
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineSegments || obj instanceof THREE.LineLoop) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            const mat = m as THREE.MeshStandardMaterial;
            mat.map?.dispose();
            mat.emissiveMap?.dispose();
            mat.dispose();
          });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
    // inView handled through ref so the loop never restarts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const scrollBy = () => window.scrollBy({ top: window.innerHeight * 0.85, behavior: "smooth" });

  if (reduced) {
    return (
      <section ref={sectionRef} className="s0-static" aria-label="Variant A — real 3D, reduced motion">
        <div className="s0-static-frame">
          <div ref={mountRef} className="s0-scene" />
          <span className="s0-variant-chip">Variant A — Real-time 3D · Three.js (WebGL) · static frame (reduced motion)</span>
          <HeroCopy visible onDiscover={() => document.getElementById("s0-notes")?.scrollIntoView()} />
          <StakeBar />
        </div>
        <StaticCaptions />
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="s0-scroll" aria-label="Variant A — real 3D">
      <div className="s0-sticky">
        {webglFailed ? (
          <>
            <img className="s0-poster-fallback" src="/spike/mockup-scene.webp" alt="NIRMAQ redevelopment scene — poster fallback" />
            <span className="s0-variant-chip">Variant A — WebGL unavailable on this device · poster fallback shown</span>
          </>
        ) : (
          <>
            <div ref={mountRef} className="s0-scene" />
            <span className="s0-variant-chip">Variant A — Real-time 3D · Three.js (WebGL)</span>
          </>
        )}
        {fps && <span className="s0-perf">{fps.fps} fps · {fps.ms} ms/frame</span>}
        <HeroCopy visible={progress < 0.1} onDiscover={scrollBy} />
        <StageCaption progress={progress} />
        {progress < 0.06 && <div className="s0-scroll-hint">Scroll to explore ↓</div>}
        <StakeBar />
      </div>
    </section>
  );
}
