import { describe, expect, test } from "bun:test";
import { MP4_UNSUPPORTED, probeMp4Support } from "@/lib/mp4Export";

// bun has no WebCodecs, so this process stands in for an unsupported browser.
// The thing being pinned is that the probe *answers* rather than throwing: a
// capability check that explodes is worse than the shallow feature-detect it
// replaced, because the caller would surface a ReferenceError instead of a
// message telling the user which browser to open.

describe("probeMp4Support", () => {
  test("resolves false where WebCodecs is absent, rather than throwing", async () => {
    expect(await probeMp4Support()).toBe(false);
  });

  test("never touches document when WebCodecs is missing", async () => {
    // It returns before the canvas work, so this holds with no DOM at all.
    expect(typeof globalThis.document).toBe("undefined");
    expect(await probeMp4Support()).toBe(false);
  });

  test("caches, so repeated calls do not re-probe", async () => {
    const a = probeMp4Support();
    const b = probeMp4Support();
    expect(a).toBe(b); // same promise instance, not merely an equal value
    expect(await a).toBe(false);
  });
});

describe("MP4_UNSUPPORTED", () => {
  test("names the browsers that do work", () => {
    expect(MP4_UNSUPPORTED).toMatch(/Chrome/);
    expect(MP4_UNSUPPORTED).toMatch(/Edge/);
  });

  test("explains the cause rather than just failing", () => {
    expect(MP4_UNSUPPORTED).toMatch(/decoder config/i);
  });
});
