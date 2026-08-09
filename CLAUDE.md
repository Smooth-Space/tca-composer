# TCA Composer

Browser-based typographic tool for The Contemporary Austin. A designer composes
title/caption layouts over templates using ABC Arizona Plus Variable, with
per-character variable-axis styling that produces a "wave" across the text.
Exports to JPG, MP4, and SVG.

## Toolchain

- **Build with `bun`, never npm.** `bun.lock` is canonical; `package-lock.json`
  is gitignored.
- `bun run dev` (vite dev) · `bun run build` → `dist` · `bun run lint` · `bun run format`
- TanStack Start + React 19 + Tailwind v4 + shadcn, deployed on **Cloudflare
  Pages** (`wrangler.toml`, Node 22, output `dist`). Cloudflare is the only
  deploy target.

## The thing to know before changing anything

**Title text renders through two completely independent implementations.**

1. **CSS path** — [`src/components/TitleBlock.tsx`](src/components/TitleBlock.tsx)
   → [`src/components/TitleLine.tsx`](src/components/TitleLine.tsx). Emits one
   `<span>` per character carrying `font-variation-settings`. This DOM is what
   the canvas shows and what `html-to-image` captures, so it drives **JPG and
   both MP4 exports** (MP4 is DOM-capture based).
2. **Glyph-path path** — [`src/lib/freeformSvg.ts`](src/lib/freeformSvg.ts).
   Used only by **SVG export**. Touches no CSS: it loads the font with fontkit
   and calls `font.getVariation({...})` → `glyph.path.toSVG()`, then does its own
   layout with its own `LETTER_SPACING_EM` / `LINE_HEIGHT` constants.

The two share only `computeAxes` (engine) and `shiftOffsets` (typo). Everything
else — casing, letter-spacing, line-height, fit sizing, line shifting, centering
— is implemented twice. **A change to how title text renders usually has to be
made in both, or the SVG export silently diverges from the canvas.** This has
caused real bugs.

Because `freeformSvg.ts` works in glyph paths rather than CSS, CSS-side solutions
do not transfer to it. Anything touching that file gets its own diagnosis pass
before implementation.

**Third consumer:** Template D uses `TitleLine` (the standalone export at the
bottom of `TitleLine.tsx`), not `TitleBlock`. It's a sibling, not a child — it
won't inherit character-level changes made in `TitleBlock`. Don't forget it.

## Type engine

[`src/lib/engine.ts`](src/lib/engine.ts) is the single source of truth for axis
values. `computeAxes(chars, mode, seed, overrides)` maps a flat character stream
— every character across **all** rows, spaces included — onto a distribution, so
position `t` is the index over the total count, never per-row.

- Three modes: `light` / `mixed` / `heavy`, each a `ModeConfig` in `MODES`.
- Only `wght` and `SRFF` vary per character. `wdth` is a constant 85 in every
  mode — intentional brand styling, not an oversight.
- `axesToCss` is the one place the `font-variation-settings` string is built, so
  every CSS-side renderer produces byte-identical output.
- Randomness is seeded (`makeRng`, mulberry32) so rerolls are reproducible.
  Default seeds in `defaultComposition` are **hardcoded constants, not
  `newSeed()`** — module evaluation must produce identical markup on server and
  client or SSR hydration fails on every load.

## Color

- [`src/lib/tcaColors.ts`](src/lib/tcaColors.ts) — the raw 12-step scales per hue.
- [`src/lib/palette.ts`](src/lib/palette.ts) — the role model. Fields pick named
  roles, not raw steps: **Light(4) / Brand(9) / Brand Shade(10) / Dark(11)**.
  `LEGAL_FG` is a fixed, verified legality table gating which foreground roles
  are allowed per background — selection is *not* gated by a live contrast
  check. Gray is a separate system using raw steps 1/2/12 with its own legality,
  plus a gray↔chromatic bridge (`grayAsRole`) for mixed-hue mode. The one
  substitution in the system: Brand foreground on a Light background renders as
  Brand Shade.
- **`applyPalette` / `resolvePalette` are the only way colors get derived.**
  Nothing should set `background`, `titleColor`, or `captionColors` by hand —
  including defaults. `defaultComposition` derives its colors from
  `resolvePalette(defaultPalette)` for exactly this reason.

## Other landmarks

- [`src/lib/composition.ts`](src/lib/composition.ts) — the `Composition` type,
  `defaultComposition`, and `normalizeComposition` (which also migrates legacy
  templates B and C onto A).
- [`src/components/ControlPanel.tsx`](src/components/ControlPanel.tsx) — large
  (~1,300 lines), holds most of the UI.
- Templates are `freeform` / `A` / `D`. SVG export is offered for `freeform`
  only, and renders `fill="#000000"` on a hardcoded white artboard — outside the
  palette system by design.
- Two copies of the font ship: `styles.css` loads the `.woff2`, `freeformSvg.ts`
  fetches the `-Trial.ttf`. They're currently identical files. Swapping in the
  licensed font means updating **both** references.

## Working agreements

- **Diagnosis before implementation.** For anything non-trivial, investigate and
  report root cause, options, and tradeoffs — then stop for a go-ahead. Don't
  jump to a fix.
- One branch per cohesive change, named `v1.x-short-description`. Verify on a
  Cloudflare preview, not just localhost, before merging. Delete the branch after.
- State tradeoffs honestly up front. If something is fragile or a bad idea, say so.
- Prefer principled, teachable rules over one-off hacks.
