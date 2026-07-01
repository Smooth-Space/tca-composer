import { tcaColor, contrastRatio, type TcaScale } from "@/lib/tcaColors";
import type { PaletteState, Composition, CaptionColors } from "@/lib/composition";

export const CAPTION_SIZE_PX = 36;
export const TITLE_THRESHOLD = 3.0; // titles are display-sized → AA-large
export const TEXT_THRESHOLD = CAPTION_SIZE_PX >= 24 ? 3.0 : 4.5;

// ---- Role model -----------------------------------------------------------
// Fields no longer pick raw 1..12 steps; they pick named roles. Only four steps
// of each 12-step scale carry meaning: Light(4), Brand(9), Shade(10), Dark(11).
export type ColorRole = "light" | "brand" | "shade" | "dark";

// Background offers all four; foreground (title/text) offers three — "shade" is
// never directly selectable, it only appears as the automatic substitution for
// Brand-on-Light (see resolveFgHex).
export const BG_ROLES: ColorRole[] = ["light", "brand", "shade", "dark"];
export const FG_ROLES: ColorRole[] = ["light", "brand", "dark"];

const ROLE_STEP: Record<ColorRole, number> = { light: 4, brand: 9, shade: 10, dark: 11 };

// Fixed legality table (bg role -> legal fg roles). Universal across all hues and
// every cross-hue mixed combination — verified, so no live contrast check gates
// selection. contrastRatio remains available purely for the informational readouts.
export const LEGAL_FG: Record<ColorRole, ColorRole[]> = {
  light: ["brand", "dark"],
  brand: ["dark"],
  shade: ["light"],
  dark: ["light", "brand"],
};

export function isFgRoleLegal(bgRole: ColorRole, fgRole: ColorRole): boolean {
  return LEGAL_FG[bgRole]?.includes(fgRole) ?? false;
}

export function firstLegalFg(bgRole: ColorRole): ColorRole {
  return LEGAL_FG[bgRole][0];
}

// ---- Grayscale (separate, not part of the chromatic role model) -----------
// Gray is a neutral ramp with no brand identity, so it never uses ColorRole /
// LEGAL_FG. It uses three raw steps directly (1, 2, 12) with exactly four legal
// pairings: 1↔12 and 2↔12. Steps 1 and 2 never pair with each other.
export type GrayStep = 1 | 2 | 12;
export const GRAY_BG_STEPS: GrayStep[] = [1, 2, 12];

const GRAY_LEGAL_FG: Record<GrayStep, GrayStep[]> = {
  1: [12],
  2: [12],
  12: [1, 2],
};

export function grayLegalFgSteps(bgStep: GrayStep): GrayStep[] {
  return GRAY_LEGAL_FG[bgStep] ?? [];
}

export function isGrayFgLegal(bgStep: GrayStep, fgStep: GrayStep): boolean {
  return GRAY_LEGAL_FG[bgStep]?.includes(fgStep) ?? false;
}

export function firstLegalGrayFg(bgStep: GrayStep): GrayStep {
  return GRAY_LEGAL_FG[bgStep][0];
}

export function resolveGrayHex(step: GrayStep): string {
  return tcaColor("gray", step);
}

// ---- Gray <-> chromatic bridge (Mixed-hue only) ---------------------------
// Gray has no Brand/Shade, but its extremes alias onto the chromatic table's
// Light/Dark roles: step 1/2 ≈ "light", step 12 ≈ "dark". This lets a gray field
// pair with a chromatic field through the SAME LEGAL_FG table — no new table.
function grayAsRole(step: GrayStep): "light" | "dark" {
  return step === 12 ? "dark" : "light";
}

// The background's effective chromatic role, whether it's chromatic or gray. Used
// so the Brand→Shade-on-Light substitution also fires for a near-white gray field.
export function effectiveBgRole(p: PaletteState): ColorRole {
  const fieldHue = fieldHueOf(p);
  return fieldHue === "gray" ? grayAsRole(p.grayBgStep ?? 1) : p.bgRole;
}

// Legal chromatic foreground roles given the current background (chromatic or gray).
export function legalChromaticFg(p: PaletteState): ColorRole[] {
  return LEGAL_FG[effectiveBgRole(p)];
}

// Legal gray foreground steps given the current background:
//  - gray background  → the pure gray table (gray+gray)
//  - chromatic bg     → bridge: "light" slot ⇒ steps 1/2, "dark" slot ⇒ step 12;
//                       gray can never fill a "brand" slot (no gray equivalent).
export function legalGrayFg(p: PaletteState): GrayStep[] {
  const fieldHue = fieldHueOf(p);
  if (fieldHue === "gray") return grayLegalFgSteps(p.grayBgStep ?? 1);
  const legal = LEGAL_FG[p.bgRole];
  const steps: GrayStep[] = [];
  if (legal.includes("light")) steps.push(1, 2);
  if (legal.includes("dark")) steps.push(12);
  return steps;
}

export interface ResolvedPalette {
  background: string;
  titleColor: string;
  textColor: string;
}

export function fieldHueOf(p: PaletteState): TcaScale {
  return p.formula === "mixed" ? p.hueB : p.hueA;
}
export function typeHueOf(p: PaletteState): TcaScale {
  return p.hueA;
}

export function resolveBgHex(hue: TcaScale, bgRole: ColorRole): string {
  return tcaColor(hue, ROLE_STEP[bgRole]);
}

// The one substitution in the system: Brand foreground on a Light background
// renders as Brand Shade (Brand is too luminous to clear 3:1 on Light). Invisible
// to the UI — there is no separate Shade chip in the title/text rows.
export function resolveFgHex(hue: TcaScale, bgRole: ColorRole, fgRole: ColorRole): string {
  const effectiveRole: ColorRole = bgRole === "light" && fgRole === "brand" ? "shade" : fgRole;
  return tcaColor(hue, ROLE_STEP[effectiveRole]);
}

export function resolvePalette(p: PaletteState): ResolvedPalette {
  const fieldHue = fieldHueOf(p);
  const typeHue = typeHueOf(p);
  // Each side resolves by its own hue's mode: gray uses raw steps, chromatic uses
  // roles. Chromatic foregrounds resolve against the background's EFFECTIVE role
  // (so a near-white gray background triggers the Brand→Shade substitution too).
  const effBg = effectiveBgRole(p);
  const background =
    fieldHue === "gray" ? resolveGrayHex(p.grayBgStep ?? 1) : resolveBgHex(fieldHue, p.bgRole);
  const titleColor =
    typeHue === "gray"
      ? resolveGrayHex(p.grayTitleStep ?? 12)
      : resolveFgHex(typeHue, effBg, p.titleRole);
  const textColor =
    typeHue === "gray"
      ? resolveGrayHex(p.grayTextStep ?? 12)
      : resolveFgHex(typeHue, effBg, p.textRole);
  return { background, titleColor, textColor };
}

// Apply a palette to a composition's resolved fields (bg, title, all four captions).
export function applyPalette(comp: Composition, p: PaletteState): Partial<Composition> {
  const r = resolvePalette(p);
  const captionColors: CaptionColors = {
    text1: r.textColor,
    text2: r.textColor,
    text3: r.textColor,
    text4: r.textColor,
  };
  return {
    palette: p,
    background: r.background,
    titleColor: r.titleColor,
    captionColors,
  };
}

// Contrast is no longer used to gate selection (the fixed table does that); it's
// re-exported for the informational readouts in the palette UI.
export { contrastRatio };
