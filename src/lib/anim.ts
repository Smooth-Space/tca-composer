export type AnimHandle = {
  durationSec: () => number;
  seekAndRender: (t: number) => void; // synchronous deterministic render at time t
  getCanvas: () => HTMLCanvasElement | null;
  setExporting: (b: boolean) => void; // idle the live rAF during export
};