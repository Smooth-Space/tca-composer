import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import type { ImageItem } from "@/lib/composition";
import { makeRng } from "@/lib/engine";

const TILE_COUNT = 24;
const SPHERE_RADIUS = 1;
const TILE_SIZE = 0.42;

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

export function MultiSphere({
  images,
  w,
  h,
  imageOverlay,
  animSeed,
  playing,
}: {
  images: ImageItem[];
  w: number;
  h: number;
  imageOverlay: number;
  animSeed: number;
  playing: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  // Build scene whenever inputs that affect geometry/textures change.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    // Fit the globe to the shorter dimension with comfortable margin.
    const fitDist = (SPHERE_RADIUS + TILE_SIZE) / Math.tan((camera.fov * Math.PI) / 360);
    const aspectPad = w < h ? 1 : h / w;
    camera.position.set(0, 0, (fitDist / Math.min(1, aspectPad)) * 1.35);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    mount.appendChild(canvas);

    const group = new THREE.Group();
    scene.add(group);

    const loader = new THREE.TextureLoader();
    const textures: THREE.Texture[] = [];
    const points = fibonacciSphere(TILE_COUNT);
    const geom = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const tiles: THREE.Mesh[] = [];

    const srcs = images.length > 0 ? images.map((im) => im.src) : [];
    points.forEach((p, i) => {
      const tileGroup = new THREE.Group();
      tileGroup.position.copy(p.clone().multiplyScalar(SPHERE_RADIUS));

      let material: THREE.Material;
      if (srcs.length > 0) {
        const tex = loader.load(srcs[i % srcs.length]);
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.push(tex);
        material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
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

      group.add(tileGroup);
    });

    // Derive 3 poses from the seed; Y steps sum to 360deg for a seamless loop.
    const rng = makeRng(animSeed);
    const startY = rng() * Math.PI * 2;
    const stepJitter = () => (rng() * 2 - 1) * 0.25; // light variation, still ~120deg
    const step1 = (Math.PI * 2) / 3 + stepJitter();
    const step2 = (Math.PI * 2) / 3 + stepJitter();
    const step3 = Math.PI * 2 - step1 - step2; // guarantees full 360 sum
    const tiltA = (rng() * 2 - 1) * 0.35;
    const tiltB = (rng() * 2 - 1) * 0.35;
    const tiltC = (rng() * 2 - 1) * 0.35;

    group.rotation.y = startY;
    group.rotation.x = tiltA;

    const tl = gsap.timeline({ repeat: -1 });
    tl.to(group.rotation, { duration: 1.3, y: startY }) // hold pose1
      .to(group.rotation, {
        duration: 1.7,
        ease: "power2.inOut",
        y: startY + step1,
        x: tiltB,
      })
      .to(group.rotation, { duration: 1.3, y: startY + step1 }) // hold pose2
      .to(group.rotation, {
        duration: 1.7,
        ease: "power2.inOut",
        y: startY + step1 + step2,
        x: tiltC,
      })
      .to(group.rotation, { duration: 1.3, y: startY + step1 + step2 }) // hold pose3
      .to(group.rotation, {
        duration: 1.7,
        ease: "power2.inOut",
        y: startY + step1 + step2 + step3,
        x: tiltA,
      });
    tlRef.current = tl;
    if (!playing) tl.pause();

    let raf = 0;
    const tmpQ = new THREE.Quaternion();
    const render = () => {
      // Billboard: each tile faces the camera.
      camera.getWorldQuaternion(tmpQ);
      for (const t of tiles) t.quaternion.copy(group.quaternion).invert().multiply(tmpQ);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      tl.kill();
      tlRef.current = null;
      geom.dispose();
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
      style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
    />
  );
}