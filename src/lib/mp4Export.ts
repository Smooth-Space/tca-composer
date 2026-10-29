import { Muxer, ArrayBufferTarget } from "mp4-muxer";

const CODECS = ["avc1.640028", "avc1.640032", "avc1.4d0028"]; // High@4.0, High@5.0, Main@4.0

async function pickCodec(w: number, h: number, fps: number, bitrate: number) {
  for (const codec of CODECS) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec,
        width: w,
        height: h,
        bitrate,
        framerate: fps,
      });
      if (supported) return codec;
    } catch {
      /* try next */
    }
  }
  throw new Error("No supported H.264 codec for this resolution.");
}

export const MP4_UNSUPPORTED =
  "MP4 export needs Chrome or Edge. This browser has WebCodecs but does not return an H.264 decoder config, which is required to write the file.";

/**
 * Can this browser actually produce a muxable H.264 MP4?
 *
 * `"VideoEncoder" in window` stopped being a proxy for "Chromium" when Safari
 * 16.4 shipped WebCodecs. Safari encodes frames happily but never hands back a
 * `decoderConfig` in the chunk metadata, and mp4-muxer needs that to write the
 * avcC/colr boxes — it dereferences `info.decoderConfig.colorSpace` unguarded in
 * finalize(). So a Safari export used to encode every frame of the composition
 * and then die with a TypeError from inside the muxer, logged to the console and
 * invisible in the UI.
 *
 * Encoding one 64x64 frame answers the question in a few milliseconds. The
 * result is cached — it cannot change for the life of the page.
 */
let supportProbe: Promise<boolean> | null = null;

export function probeMp4Support(): Promise<boolean> {
  supportProbe ??= runSupportProbe();
  return supportProbe;
}

async function runSupportProbe(): Promise<boolean> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return false;

  const SIZE = 64;
  const BITRATE = 1_000_000;
  const FPS = 30;

  let codec: string;
  try {
    codec = await pickCodec(SIZE, SIZE, FPS, BITRATE);
  } catch {
    return false;
  }

  let encoder: VideoEncoder | null = null;
  try {
    let sawDecoderConfig = false;
    encoder = new VideoEncoder({
      output: (_chunk, meta) => {
        if (meta?.decoderConfig) sawDecoderConfig = true;
      },
      error: () => {},
    });
    encoder.configure({ codec, width: SIZE, height: SIZE, bitrate: BITRATE, framerate: FPS });

    const cap = document.createElement("canvas");
    cap.width = SIZE;
    cap.height = SIZE;
    const ctx = cap.getContext("2d");
    if (!ctx) return false;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, SIZE, SIZE);

    const frame = new VideoFrame(cap, { timestamp: 0 });
    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush(); // output callbacks have all fired by here
    return sawDecoderConfig;
  } catch {
    return false;
  } finally {
    try {
      encoder?.close();
    } catch {
      /* already closed or errored */
    }
  }
}

// Globe/conveyor export: synchronous seekAndRender drives the animation canvas,
// which is then composited with a pre-rendered title overlay.
export async function exportLoopMp4({
  w,
  h,
  fps,
  durationSec,
  seekAndRender,
  globeCanvas,
  overlayImg,
  background,
  onProgress,
  filename,
  rect,
}: {
  w: number;
  h: number;
  fps: number;
  durationSec: number;
  seekAndRender: (t: number) => void;
  globeCanvas: HTMLCanvasElement;
  overlayImg: HTMLImageElement | null;
  background: string;
  onProgress?: (p: number) => void;
  filename: string;
  rect: { x: number; y: number; w: number; h: number };
}) {
  if (!(await probeMp4Support())) throw new Error(MP4_UNSUPPORTED);
  const bitrate = 12_000_000;
  const codec = await pickCodec(w, h, fps, bitrate);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: w, height: h },
    fastStart: "in-memory", // moov atom at front — needed for web/social playback
  });
  // decoderConfig arrives on the first chunk's metadata and is what mp4-muxer
  // needs to write avcC/colr. Tracking it turns an unguarded dereference inside
  // finalize() into a message that says what to do. Encoder errors are captured
  // rather than logged, so a failed encode cannot finish as a silent no-op.
  let sawDecoderConfig = false;
  let encoderError: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (meta?.decoderConfig) sawDecoderConfig = true;
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      encoderError ??= e;
    },
  });
  encoder.configure({ codec, width: w, height: h, bitrate, framerate: fps });

  const cap = document.createElement("canvas");
  cap.width = w;
  cap.height = h;
  const ctx = cap.getContext("2d")!;
  const total = Math.round(durationSec * fps); // frame[total] == frame[0] (loop point), stop at total

  for (let i = 0; i < total; i++) {
    const t = i / fps;
    seekAndRender(t); // synchronous render of the globe at time t
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(globeCanvas, rect.x, rect.y, rect.w, rect.h); // animation layer at its rect
    if (overlayImg) ctx.drawImage(overlayImg, 0, 0, w, h); // title + captions
    const frame = new VideoFrame(cap, { timestamp: Math.round(t * 1_000_000) });
    encoder.encode(frame, { keyFrame: i % fps === 0 });
    frame.close(); // RELEASE — never accumulate raw frames
    if (i % 3 === 0) onProgress?.(i / total);
    if (encoder.encodeQueueSize > fps) await new Promise((r) => setTimeout(r)); // drain queue
  }

  await encoder.flush();
  if (encoderError) throw encoderError;
  if (!sawDecoderConfig) throw new Error(MP4_UNSUPPORTED);
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  onProgress?.(1);
}

// Title-phase animation export: async per-frame DOM capture.
// renderFrame is called for each frame; it sets the export phase, waits for
// React to re-render, then captures the full composition to a canvas.
export async function exportTitleMp4({
  w,
  h,
  fps,
  durationSec,
  renderFrame,
  onProgress,
  filename,
}: {
  w: number;
  h: number;
  fps: number;
  durationSec: number;
  renderFrame: (i: number, total: number) => Promise<HTMLCanvasElement>;
  onProgress?: (p: number) => void;
  filename: string;
}) {
  if (!(await probeMp4Support())) throw new Error(MP4_UNSUPPORTED);
  const bitrate = 12_000_000;
  const codec = await pickCodec(w, h, fps, bitrate);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: w, height: h },
    fastStart: "in-memory",
  });
  // decoderConfig arrives on the first chunk's metadata and is what mp4-muxer
  // needs to write avcC/colr. Tracking it turns an unguarded dereference inside
  // finalize() into a message that says what to do. Encoder errors are captured
  // rather than logged, so a failed encode cannot finish as a silent no-op.
  let sawDecoderConfig = false;
  let encoderError: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (meta?.decoderConfig) sawDecoderConfig = true;
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      encoderError ??= e;
    },
  });
  encoder.configure({ codec, width: w, height: h, bitrate, framerate: fps });

  const total = Math.round(durationSec * fps);
  for (let i = 0; i < total; i++) {
    const t = i / fps;
    const canvas = await renderFrame(i, total);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(t * 1_000_000) });
    encoder.encode(frame, { keyFrame: i % fps === 0 });
    frame.close();
    if (i % 3 === 0) onProgress?.(i / total);
    if (encoder.encodeQueueSize > fps) await new Promise((r) => setTimeout(r));
  }

  await encoder.flush();
  if (encoderError) throw encoderError;
  if (!sawDecoderConfig) throw new Error(MP4_UNSUPPORTED);
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  onProgress?.(1);
}
