import { IT_CLOSE, IT_OPEN } from "@/lib/titleItalic";

// Straight ' and " are typewriter marks. Curly quotes are what this typeface is
// drawn for, and each one is a single glyph (quotedblleft / quotedblright), so a
// double quote keeps its two marks at the spacing Dinamo drew — one character in
// the stream, one weight from the wave, and letter-spacing cannot reach inside it.
//
// Substitution happens at INPUT time, one character at a time, so what is stored
// is exactly what renders. Pasted text is left alone, which is the escape hatch
// for inch marks in dimensions (36 × 24").
export const LEFT_SINGLE = "‘"; // ‘
export const RIGHT_SINGLE = "’"; // ’
export const LEFT_DOUBLE = "“"; // “
export const RIGHT_DOUBLE = "”"; // ”

export const STRAIGHT_SINGLE = "'";
export const STRAIGHT_DOUBLE = '"';

export function isStraightQuote(ch: string): boolean {
  return ch === STRAIGHT_SINGLE || ch === STRAIGHT_DOUBLE;
}

// A quote opens when nothing meaningful precedes it, when it follows whitespace,
// an opening bracket, another opening quote, or a dash. Everything else closes.
//
// This is the standard rule. It is correct for ordinary prose and deliberately
// wrong for elisions — '90s and rock 'n' roll get an opening mark where a closing
// one belongs, because nothing in the surrounding characters distinguishes them
// from a genuine opening quote. Fix those by hand on the rare occasion they occur.
const OPENERS = new Set(["(", "[", "{", "<", LEFT_SINGLE, LEFT_DOUBLE, "—", "–", "-"]);

/**
 * The curly form of the straight quote at `index`.
 *
 * Returns the character unchanged if `index` does not hold a straight quote, so
 * callers can apply this without first checking.
 */
export function smartQuoteAt(text: string, index: number): string {
  const ch = text[index];
  if (!isStraightQuote(ch)) return ch;

  // Italic markup lives inline in the title string as two zero-width sentinels.
  // They are invisible to the reader, so they must be invisible to this rule too —
  // otherwise a quote opening an italic run would see a sentinel rather than the
  // space before it and wrongly close.
  let i = index - 1;
  while (i >= 0 && (text[i] === IT_OPEN || text[i] === IT_CLOSE)) i--;

  const open = i < 0 || /\s/.test(text[i]) || OPENERS.has(text[i]);
  if (ch === STRAIGHT_DOUBLE) return open ? LEFT_DOUBLE : RIGHT_DOUBLE;
  return open ? LEFT_SINGLE : RIGHT_SINGLE;
}

/**
 * Replace the straight quote at `index` with its curly form.
 *
 * Always length-preserving — one character in, one character out — which is what
 * lets the caller leave the caret where the browser put it.
 */
export function applySmartQuoteAt(text: string, index: number): string {
  if (index < 0 || index >= text.length) return text;
  const replacement = smartQuoteAt(text, index);
  if (replacement === text[index]) return text;
  return text.slice(0, index) + replacement + text.slice(index + 1);
}

/**
 * Convert every straight quote in a string, left to right.
 *
 * Not used by the live textarea — typing goes one character at a time through
 * applySmartQuoteAt, which is what preserves pasted inch marks. This exists for
 * bulk conversion of existing text, and for tests to assert whole phrases.
 */
export function smartQuotes(text: string): string {
  let out = text;
  for (let i = 0; i < out.length; i++) {
    if (isStraightQuote(out[i])) out = applySmartQuoteAt(out, i);
  }
  return out;
}
