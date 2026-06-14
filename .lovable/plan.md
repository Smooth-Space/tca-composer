Move the text-case toggle from a global composition setting to a per-title setting.

## What changes

1. **Data model** — `Title` gains a `case: TitleCase` field; remove `titleCase` from `Composition` and `defaultComposition`.
2. **Canvas** — read `case` from each title object instead of the global `comp.titleCase`.
3. **ControlPanel** — add a compact UPPER / Sentence segmented toggle on every title row (beside the text input and delete button). Remove the global case control from the Titles section.

No other behavior changes.