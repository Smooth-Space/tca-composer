import { ITALIC_SLNT, type Axes } from "@/lib/engine";

// Inline italics are stored as markup inside the ordinary title string, using two
// invisible sentinels. The title <textarea> stays a plain textarea — this feature
// never introduces contentEditable. Formatting lives in the string and is re-parsed
// on every render, so there is no separate range-tracking state to drift.
//
// Why these two code points specifically:
//   - Verified zero-width in the real control-panel textarea. Private Use Area
//     sentinels (U+E000/U+E001) were tried first, and Chrome draws its striped
//     hex-box for them — visibly broken in the input. Do not go back to PUA.
//   - Invisible math operators never occur in ordinary prose, so — like PUA, and
//     unlike U+200B/U+FEFF — user text cannot collide with them and there is
//     nothing to escape.
//   - They create no line-break opportunity (U+200B ZERO WIDTH SPACE does), which
//     matters because titles wrap across rows.
export const IT_OPEN = "\u2061"; // FUNCTION APPLICATION
export const IT_CLOSE = "\u2062"; // INVISIBLE TIMES

const isDelim = (ch: string) => ch === IT_OPEN || ch === IT_CLOSE;

export interface ParsedTitle {
  /** Clean display text — ALWAYS delimiter-free, for any input whatsoever. */
  text: string;
  /** Per code point of `text`. Same length as Array.from(text). */
  isItalic: boolean[];
  /** cleanToRawStart[k] = UTF-16 offset in `raw` where clean code point k begins. */
  cleanToRawStart: number[];
  /** cleanToRawEnd[k] = UTF-16 offset in `raw` just past clean code point k. */
  cleanToRawEnd: number[];
}

/**
 * Parse italic markup out of a stored title string.
 *
 * Defensive by contract: `text` is always delimiter-free and this never throws,
 * whatever the input. Only a well-formed OPEN…CLOSE pair enclosing at least one
 * character counts as italic. Everything else — a lone opener, a closer with no
 * opener, an empty pair, a second opener before the first closed — is stray and is
 * silently stripped, rendering as plain upright text. That guarantee is what keeps
 * PUA sentinels out of exports: no code point in this range can reach a renderer.
 */
export function parseTitleMarkup(raw: string): ParsedTitle {
  const cps = Array.from(raw ?? "");

  // Pass 1 — decide which delimiters form real pairs. Requires lookahead, because
  // whether an opener counts depends on a closer appearing later.
  const opens = new Array<boolean>(cps.length).fill(false);
  const closes = new Array<boolean>(cps.length).fill(false);
  let pending = -1; // index of an unclosed opener, or -1
  let sawContent = false; // at least one real character since `pending`
  for (let i = 0; i < cps.length; i++) {
    const ch = cps[i];
    if (ch === IT_OPEN) {
      pending = i; // a second opener supersedes the first, which becomes stray
      sawContent = false;
    } else if (ch === IT_CLOSE) {
      if (pending >= 0 && sawContent) {
        opens[pending] = true;
        closes[i] = true;
      }
      pending = -1;
      sawContent = false;
    } else if (pending >= 0) {
      sawContent = true;
    }
  }

  // Pass 2 — emit clean text, italic flags, and the raw offset map.
  const out: string[] = [];
  const isItalic: boolean[] = [];
  const cleanToRawStart: number[] = [];
  const cleanToRawEnd: number[] = [];
  let italic = false;
  let rawOffset = 0; // UTF-16 offset, so it lines up with textarea selection offsets
  for (let i = 0; i < cps.length; i++) {
    const ch = cps[i];
    if (opens[i]) italic = true;
    else if (closes[i]) italic = false;
    else if (!isDelim(ch)) {
      out.push(ch);
      isItalic.push(italic);
      cleanToRawStart.push(rawOffset);
      cleanToRawEnd.push(rawOffset + ch.length);
    }
    rawOffset += ch.length;
  }

  return { text: out.join(""), isItalic, cleanToRawStart, cleanToRawEnd };
}

/**
 * Rebuild a stored title string from clean text + italic flags.
 *
 * Canonical by construction: runs are emitted as exactly one delimiter pair, so
 * adjacent runs coalesce, empty pairs cannot occur, and no delimiter can be
 * orphaned. Because every edit round-trips through here, any stray markup elsewhere
 * in the title is repaired as a side effect.
 */
export function serializeTitleMarkup(text: string, isItalic: boolean[]): string {
  const cps = Array.from(text);
  let out = "";
  let open = false;
  for (let i = 0; i < cps.length; i++) {
    const want = isItalic[i] === true;
    if (want && !open) {
      out += IT_OPEN;
      open = true;
    } else if (!want && open) {
      out += IT_CLOSE;
      open = false;
    }
    out += cps[i];
  }
  if (open) out += IT_CLOSE;
  return out;
}

/** Clean code-point index for a raw UTF-16 offset (chars fully before the offset). */
function rawToCleanIndex(p: ParsedTitle, rawOffset: number): number {
  let n = 0;
  while (n < p.cleanToRawEnd.length && p.cleanToRawEnd[n] <= rawOffset) n++;
  return n;
}

export interface ToggleResult {
  text: string;
  selStart: number;
  selEnd: number;
}

/**
 * Toggle italics over a textarea selection.
 *
 * `selStart`/`selEnd` are raw UTF-16 offsets exactly as the textarea reports them —
 * no conversion at the call site. Everything crosses into clean code-point space
 * here and nowhere else, so the two index spaces never have to meet in the UI.
 *
 * Toggle semantics: any non-italic character in the selection → the whole selection
 * becomes italic; only when the selection is entirely italic does it go upright. So
 * Cmd+I on a partly-italic selection goes fully italic first, upright on a second press.
 *
 * A collapsed selection is a no-op (returns the input unchanged).
 */
export function toggleItalicRange(raw: string, selStart: number, selEnd: number): ToggleResult {
  const lo = Math.min(selStart, selEnd);
  const hi = Math.max(selStart, selEnd);
  const parsed = parseTitleMarkup(raw);

  const cleanStart = rawToCleanIndex(parsed, lo);
  const cleanEnd = rawToCleanIndex(parsed, hi);
  if (cleanStart >= cleanEnd) return { text: raw, selStart, selEnd };

  const next = parsed.isItalic.slice();
  const allItalic = next.slice(cleanStart, cleanEnd).every(Boolean);
  for (let i = cleanStart; i < cleanEnd; i++) next[i] = !allItalic;

  const text = serializeTitleMarkup(parsed.text, next);

  // Re-derive selection offsets against the NEW string: delimiters shift them, and
  // the run's opener must fall outside the selection so a second press re-toggles
  // the same visible characters.
  const after = parseTitleMarkup(text);
  const nextStart = after.cleanToRawStart[cleanStart] ?? text.length;
  const nextEnd = cleanEnd > 0 ? (after.cleanToRawEnd[cleanEnd - 1] ?? text.length) : nextStart;
  return { text, selStart: nextStart, selEnd: nextEnd };
}

/** True if the given textarea selection is entirely italic (drives the button's pressed state). */
export function isRangeItalic(raw: string, selStart: number, selEnd: number): boolean {
  const lo = Math.min(selStart, selEnd);
  const hi = Math.max(selStart, selEnd);
  const parsed = parseTitleMarkup(raw);
  const a = rawToCleanIndex(parsed, lo);
  const b = rawToCleanIndex(parsed, hi);
  if (a >= b) return false;
  return parsed.isItalic.slice(a, b).every(Boolean);
}

export interface TitleDisplay {
  /** Clean text with newlines intact. */
  text: string;
  rows: string[];
  /** Flat character stream, newlines removed — what computeAxes consumes. */
  flatChars: string[];
  /** Italic flags aligned 1:1 with flatChars. */
  flatItalic: boolean[];
  /** Start index of each row within the flat stream. */
  rowStart: number[];
}

/**
 * The one function every render path calls to turn a stored title into renderable
 * characters. TitleBlock (canvas/JPG/MP4), TemplateD, and freeformSvg (SVG export)
 * all go through here, which is what stops the CSS and glyph-path paths from drifting.
 *
 * Order matters: markup is parsed FIRST, then uppercase is applied to the clean text.
 * Because parsing runs first, the clean character count is unaffected by italic
 * markup — so toggling italics can never shift the wght/SRFF wave.
 *
 * Uppercasing maps code point by code point and repeats the italic flag across any
 * expansion (ß→SS), keeping flags aligned. Output matches whole-string toUpperCase()
 * for everything but a few context-sensitive cases (e.g. Greek final sigma), which
 * this display font isn't used for.
 */
export function titleDisplay(raw: string, uppercase: boolean): TitleDisplay {
  const parsed = parseTitleMarkup(raw);
  const srcChars = Array.from(parsed.text);

  const chars: string[] = [];
  const flags: boolean[] = [];
  for (let i = 0; i < srcChars.length; i++) {
    const mapped = uppercase ? srcChars[i].toUpperCase() : srcChars[i];
    for (const ch of Array.from(mapped)) {
      chars.push(ch);
      flags.push(parsed.isItalic[i] === true);
    }
  }

  const rows: string[] = [];
  const rowStart: number[] = [];
  const flatChars: string[] = [];
  const flatItalic: boolean[] = [];
  let current: string[] = [];
  rowStart.push(0);
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === "\n") {
      rows.push(current.join(""));
      current = [];
      rowStart.push(flatChars.length);
    } else {
      current.push(chars[i]);
      flatChars.push(chars[i]);
      flatItalic.push(flags[i]);
    }
  }
  rows.push(current.join(""));

  return { text: chars.join(""), rows, flatChars, flatItalic, rowStart };
}

/** Overlay slant onto wave axes. Non-italic characters keep the upright value. */
export function applyItalic(axes: Axes[], flatItalic: boolean[]): Axes[] {
  return axes.map((a, i) => (flatItalic[i] ? { ...a, slnt: ITALIC_SLNT } : a));
}
