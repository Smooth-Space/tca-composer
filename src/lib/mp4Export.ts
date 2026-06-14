import { Muxer, ArrayBufferTarget } from "mp4-muxer";

const CODECS = ["avc1.640028", "avc1.640032", "avc1.4d0028"]; // High@4.0, High@5.0, Main@4.0

async function pickCodec(w: number, h: number, fps: number, bitrate: number) {
  for (const codec of CODECS) {
    try {
      const { supported } = await (window as any).VideoEncoder.isConfigSupported({
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
}) {
  if (!("VideoEncoder" in window))
    throw new Error("MP4 export needs a Chromium browser (Chrome/Edge).");
  const bitrate = 12_000_000;
  const codec = await pickCodec(w, h, fps, bitrate);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: w, height: h },
    fastStart: "in-memory", // moov atom at front — needed for web/social playback
  });
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error(e),
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
    ctx.drawImage(globeCanvas, 0, 0, w, h); // globe (native res)
    if (overlayImg) ctx.drawImage(overlayImg, 0, 0, w, h); // title + captions
    const frame = new VideoFrame(cap, { timestamp: Math.round(t * 1_000_000) });
    encoder.encode(frame, { keyFrame: i % fps === 0 });
    frame.close(); // RELEASE — never accumulate raw frames
    if (i % 3 === 0) onProgress?.(i / total);
    if (encoder.encodeQueueSize > fps) await new Promise((r) => setTimeout(r)); // drain queue
  }

  await encoder.flush();
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  onProgress?.(1);
}