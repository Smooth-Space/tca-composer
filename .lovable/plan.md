## Goal
Show the TCA wordmark logo at the top of the left sidebar (where the "Composer" title used to be), correctly sized and in color `#121212`.

## Diagnosis
- The `Wordmark` SVG component already exists in `src/components/ControlPanel.tsx` and is rendered at the top of the sidebar `<aside>`.
- Live preview check confirms the `<svg>` is present in the DOM, but it renders with effectively zero width, so nothing is visible — only empty space above the FORMAT panel.
- Root cause: the element uses `className="block h-5 w-auto"`. An inline SVG that is a flex child, with only a height set and `width:auto`, does not reliably derive its width from the `viewBox` in this layout, so it collapses to no width.
- Secondary correctness point: the uploaded source SVG paths use `fill="white"` (invisible on the white sidebar). The component must keep dark fills (`#121212`).

## Changes (single file: `src/components/ControlPanel.tsx`)
1. Give the wordmark an explicit, deterministic size so it always renders:
   - Replace `className="block h-5 w-auto"` with an explicit width while keeping the 20px height, e.g. `className="block h-5 w-[158px]"` (158px = 20px × 150/19 viewBox ratio), or equivalently set `style={{ height: 20, width: 158 }}`.
   - Keep the `width="150" height="19"` and `viewBox="0 0 150 19"` attributes intact.
2. Ensure the logo color is `#121212`:
   - Keep `style={{ color: "#121212" }}` on the `<svg>` with all paths using `fill="currentColor"` (current state already does this) so the wordmark is dark, not white.

## Verification
- Reload the preview and confirm the TCA wordmark appears at the top-left of the sidebar, crisp, ~20px tall, in dark `#121212`, in the spot where "Composer" used to be.
