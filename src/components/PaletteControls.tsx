import type { Composition, PaletteFormula, PaletteState } from "@/lib/composition";
import { TCA_SCALES, tcaColor, type TcaScale } from "@/lib/tcaColors";
import {
  applyPalette,
  bestPassingStep,
  fieldHueOf,
  isStepSelectable,
  stepContrast,
  typeHueOf,
  TITLE_THRESHOLD,
  TEXT_THRESHOLD,
} from "@/lib/palette";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { X, Check } from "lucide-react";

const HUE_LABEL: Record<TcaScale, string> = {
  gray: "Gray",
  red: "Red",
  gold: "Gold",
  green: "Green",
  teal: "Teal",
  blue: "Blue",
  purple: "Purple",
};

// Representative step for each hue's round picker chip.
const HUE_CHIP_STEP: Record<TcaScale, number> = {
  gray: 12,
  red: 9,
  gold: 9,
  green: 9,
  teal: 9,
  blue: 9,
  purple: 9,
};

function HuePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TcaScale;
  onChange: (v: TcaScale) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {TCA_SCALES.map((s) => (
          <button
            key={s}
            type="button"
            title={HUE_LABEL[s]}
            onClick={() => onChange(s)}
            className={cn(
              "h-7 w-7 rounded-full border transition-shadow",
              value === s
                ? "border-ring ring-2 ring-ring ring-offset-1 ring-offset-background"
                : "border-border",
            )}
            style={{ background: tcaColor(s, HUE_CHIP_STEP[s]) }}
          />
        ))}
      </div>
    </div>
  );
}

function StepStrip({
  palette,
  hue,
  current,
  threshold,
  onPick,
}: {
  palette: PaletteState;
  hue: TcaScale;
  current: number;
  threshold?: number;
  onPick: (step: number) => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-0.5">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((step) => {
        const selectable = threshold === undefined || isStepSelectable(palette, step, threshold);
        const selected = step === current;
        const ratio = threshold !== undefined ? stepContrast(palette, step) : undefined;
        return (
          <button
            key={step}
            type="button"
            disabled={!selectable}
            onClick={() => selectable && onPick(step)}
            title={ratio !== undefined ? `Step ${step} · ${ratio.toFixed(1)}:1` : `Step ${step}`}
            className={cn(
              "relative h-8 rounded-sm border transition-shadow",
              selected
                ? "border-ring ring-2 ring-ring"
                : selectable
                  ? "border-border hover:border-foreground/40"
                  : "border-border cursor-not-allowed",
            )}
            style={{ background: tcaColor(hue, step) }}
          >
            {!selectable && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full"
                  style={{ background: "rgba(0,0,0,0.12)" }}
                >
                  <X
                    className="h-3 w-3"
                    strokeWidth={2.5}
                    style={{ color: step <= 9 ? "#23201B" : "#FDFBF7" }}
                  />
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ContrastReadout({ label, ratio }: { label: string; ratio: number }) {
  const pass = ratio >= 3.0;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-mono">
        {ratio.toFixed(2)}:1
        <span
          className={cn(
            "flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold",
            pass
              ? "bg-success/15 text-success"
              : "bg-muted text-muted-foreground",
          )}
        >
          {pass ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
          {pass ? "AA-large" : "fail"}
        </span>
      </span>
    </div>
  );
}

export function PaletteControls({
  comp,
  update,
}: {
  comp: Composition;
  update: (patch: Partial<Composition>) => void;
}) {
  const p = comp.palette;

  // Apply a new palette state to the resolved fields.
  const apply = (next: PaletteState) => update(applyPalette(comp, next));

  // When formula / hue / background changes, re-land title & text on best passing steps.
  const reland = (partial: Partial<PaletteState>) => {
    const merged: PaletteState = { ...p, ...partial };
    const titleStep = bestPassingStep(merged, TITLE_THRESHOLD);
    apply({ ...merged, titleStep, textStep: titleStep });
  };

  const fieldHue = fieldHueOf(p);
  const typeHue = typeHueOf(p);
  const titleRatio = stepContrast(p, p.titleStep);
  const textRatio = stepContrast(p, p.textStep);

  return (
    <div className="space-y-4">
      {/* Formula */}
      <div className="space-y-1.5">
        <Label className="text-xs">Formula</Label>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["mono", "mixed"] as PaletteFormula[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => reland({ formula: f })}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition-colors",
                p.formula === f
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "mono" ? "Monochrome" : "Mixed-hue"}
            </button>
          ))}
        </div>
      </div>

      {/* Hue(s) */}
      {p.formula === "mono" ? (
        <HuePicker label="Hue" value={p.hueA} onChange={(v) => reland({ hueA: v })} />
      ) : (
        <>
          <HuePicker label="Type hue" value={p.hueA} onChange={(v) => reland({ hueA: v })} />
          <HuePicker label="Background hue" value={p.hueB} onChange={(v) => reland({ hueB: v })} />
        </>
      )}

      {/* Background strip */}
      <div className="space-y-1.5">
        <Label className="text-xs">Background</Label>
        <StepStrip
          palette={p}
          hue={fieldHue}
          current={p.bgStep}
          onPick={(step) => reland({ bgStep: step })}
        />
      </div>

      {/* Title strip */}
      <div className="space-y-1.5">
        <Label className="text-xs">Title</Label>
        <StepStrip
          palette={p}
          hue={typeHue}
          current={p.titleStep}
          threshold={TITLE_THRESHOLD}
          onPick={(step) => apply({ ...p, titleStep: step })}
        />
      </div>

      {/* Text strip */}
      <div className="space-y-1.5">
        <Label className="text-xs">Text</Label>
        <StepStrip
          palette={p}
          hue={typeHue}
          current={p.textStep}
          threshold={TEXT_THRESHOLD}
          onPick={(step) => apply({ ...p, textStep: step })}
        />
      </div>

      {/* Live contrast readouts */}
      <div className="space-y-1 rounded-md border border-border bg-muted/50 p-2">
        <ContrastReadout label="Title on background" ratio={titleRatio} />
        <ContrastReadout label="Text on background" ratio={textRatio} />
      </div>
    </div>
  );
}
