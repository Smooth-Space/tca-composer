import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import type { ImageItem } from "@/lib/composition";
import type { AnimHandle } from "@/lib/anim";
import { makeRng } from "@/lib/engine";

const SPHERE_RADIUS = 1;
const TILE_SIZE = 0.45 * SPHERE_RADIUS; // tile edge ≈ 0.45 × R
const FOV = 45;
const FRAME_FILL = 0.8; // globe projected diameter ≈ 0.8 × shorter frame dim at scale 1
const MIN_DIST_FACTOR = 1.2; // camera never closer than 1.2 × R (stays outside)

// Camera distance that drives globeScale by dollying. globeScale = 1 frames the
// whole globe; larger values move the camera closer (D = D_full / globeScale),
// clamped so the camera always stays outside the sphere.
function cameraDistance(w: number, h: number, globeScale: number): number {
  const focalPx = h / 2 / Math.tan((FOV * Math.PI) / 360);
  const targetPx = FRAME_FILL * Math.min(w, h);
  const dFull = (2 * SPHERE_RADIUS * focalPx) / targetPx;
  const d = dFull / globeScale;
  return Math.max(d, MIN_DIST_FACTOR * SPHERE_RADIUS);
}

// Evenly distributed points on a unit sphere (Fibonacci sphere).
function fibonacciSphere(n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2; // 1..-1
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }
  return pts;
}

export type MultiSphereHandle = AnimHandle;

type Props = {
  images: ImageItem[];
  w: number;
  h: number;
  imageOverlay: number;
  animSeed: number;
  playing: boolean;
  globeScale: number;
};

export const MultiSphere = forwardRef<MultiSphereHandle, Props>(function MultiSphere(
  { images, w, h, imageOverlay, animSeed, playing, globeScale },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const seekRef = useRef<(t: number) => void>(() => {});
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const exportingRef = useRef(false);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useImperativeHandle(
    ref,
    () => ({
      durationSec: () => tlRef.current?.duration() ?? 0,
      seekAndRender: (t) => seekRef.current(t),
      getCanvas: () => canvasElRef.current,
      setExporting: (b) => {
        exportingRef.current = b;
        const tl = tlRef.current;
        if (b) tl?.pause();
        else if (playingRef.current) tl?.resume();
      },
    }),
    [],
  );

  // Build scene whenever inputs that affect geometry/textures change.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    // Empty state: render nothing.
    if (images.length === 0) return;
    const TILE_COUNT = images.length;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 100);
    // Frame the whole globe from outside; globeScale dollies the camera.
    camera.position.set(0, 0, cameraDistance(w, h, globeScale));
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvasElRef.current = canvas;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    mount.appendChild(canvas);

    // Group nesting: spinGroup (world Y spin) → tiltGroup (constant X tilt) → tiles.
    const spinGroup = new THREE.Group();
    scene.add(spinGroup);
    groupRef.current = spinGroup;

    const TILT = THREE.MathUtils.degToRad(30);
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.x = TILT;
    spinGroup.add(tiltGroup);

    const loader = new THREE.TextureLoader();
    const textures: THREE.Texture[] = [];
    const geoms: THREE.PlaneGeometry[] = [];
    const points = fibonacciSphere(TILE_COUNT);
    const tiles: THREE.Mesh[] = [];

    const srcs = images.length > 0 ? images.map((im) => im.src) : [];

    // Each tile takes its image's native aspect ratio: longer edge = TILE_SIZE.
    const dims = points.map((_, i) => {
      const im = images[i % images.length];
      const ar =
        im && im.naturalWidth > 0 && im.naturalHeight > 0
          ? im.naturalWidth / im.naturalHeight
          : 1;
      let tw: number, th: number;
      if (ar >= 1) {
        tw = TILE_SIZE;
        th = TILE_SIZE / ar;
      } else {
        th = TILE_SIZE;
        tw = TILE_SIZE * ar;
      }
      return { tw, th };
    });

    // Auto-shrink: scale all tiles by a single factor so none overlap.
    let shrink = 1;
    for (let i = 0; i < points.length; i++) {
      const ri = 0.5 * Math.sqrt(dims[i].tw ** 2 + dims[i].th ** 2);
      for (let j = i + 1; j < points.length; j++) {
        const rj = 0.5 * Math.sqrt(dims[j].tw ** 2 + dims[j].th ** 2);
        const chord = points[i].distanceTo(points[j]) * SPHERE_RADIUS;
        if (chord < ri + rj) shrink = Math.min(shrink, chord / (ri + rj));
      }
    }

    points.forEach((p, i) => {
      const tileGroup = new THREE.Group();
      tileGroup.position.copy(p.clone().multiplyScalar(SPHERE_RADIUS));

      const geom = new THREE.PlaneGeometry(dims[i].tw * shrink, dims[i].th * shrink);
      geoms.push(geom);

      let material: THREE.Material;
      if (srcs.length > 0) {
        const tex = loader.load(srcs[i % srcs.length], (t) => {
          t.needsUpdate = true;
        });
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = maxAniso;
        textures.push(tex);
        material = new THREE.MeshBasicMaterial({
          map: tex,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
      } else {
        material = new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide });
      }
      const mesh = new THREE.Mesh(geom, material);
      tileGroup.add(mesh);
      tiles.push(mesh);

      if (imageOverlay > 0) {
        const overlayMat = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: imageOverlay,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const overlay = new THREE.Mesh(geom, overlayMat);
        overlay.position.z = 0.001;
        mesh.add(overlay);
      }

      tiltGroup.add(tileGroup);
    });

    // Derive 3 poses from the seed; Y steps sum to 360deg for a seamless loop.
    const rng = makeRng(animSeed);
    const startY = rng() * Math.PI * 2;
    const stepJitter = () => (rng() * 2 - 1) * 0.25; // light variation, still ~120deg
    const step1 = (Math.PI * 2) / 3 + stepJitter();
    const step2 = (Math.PI * 2) / 3 + stepJitter();
    const step3 = Math.PI * 2 - step1 - step2; // guarantees full 360 sum

    spinGroup.rotation.y = startY;

    const tl = gsap.timeline({ repeat: -1 });
    tl.to(spinGroup.rotation, { duration: 1.3, y: startY }) // hold pose1
      .to(spinGroup.rotation, {
        duration: 1.7,
        ease: "power2.inOut",
        y: startY + step1,
      })
      .to(spinGroup.rotation, { duration: 1.3, y: startY + step1 }) // hold pose2
      .to(spinGroup.rotation, {
        duration: 1.7,
        ease: "power2.inOut",
        y: startY + step1 + step2,
      })
      .to(spinGroup.rotation, { duration: 1.3, y: startY + step1 + step2 }) // hold pose3
      .to(spinGroup.rotation, {
        duration: 1.7,
        ease: "power2.inOut",
        y: startY + step1 + step2 + step3,
      });
    tlRef.current = tl;
    if (!playing) tl.pause();

    let raf = 0;
    const tmpQ = new THREE.Quaternion();
    const parentQ = new THREE.Quaternion();
    const renderFrame = () => {
      // Billboard: each tile faces the camera, accounting for tilt + spin.
      camera.getWorldQuaternion(tmpQ);
      tiltGroup.getWorldQuaternion(parentQ);
      for (const t of tiles) t.quaternion.copy(parentQ).invert().multiply(tmpQ);
      renderer.render(scene, camera);
    };
    seekRef.current = (t: number) => {
      const tl = tlRef.current;
      if (tl) {
        tl.pause();
        tl.time(t);
      }
      renderFrame(); // synchronous: seek → billboard → render
    };
    const loop = () => {
      if (!exportingRef.current) renderFrame(); // idle live loop during export
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      tl.kill();
      tlRef.current = null;
      groupRef.current = null;
      cameraRef.current = null;
      seekRef.current = () => {};
      canvasElRef.current = null;
      geoms.forEach((g) => g.dispose());
      textures.forEach((t) => t.dispose());
      tiles.forEach((t) => {
        const m = t.material as THREE.Material;
        m.dispose();
        t.children.forEach((c) => {
          if (c instanceof THREE.Mesh) (c.material as THREE.Material).dispose();
        });
      });
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [images, w, h, imageOverlay, animSeed]);

  // Re-frame (dolly the camera) without rebuilding the scene.
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.z = cameraDistance(w, h, globeScale);
    camera.lookAt(0, 0, 0);
  }, [globeScale, w, h]);

  // Play/pause without rebuilding the scene.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (playing) tl.resume();
    else tl.pause();
  }, [playing]);

  return (
    <div
      ref={mountRef}
      data-anim="true"
      style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
    />
  );
});