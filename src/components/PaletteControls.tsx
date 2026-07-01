import type { Composition, PaletteFormula, PaletteState } from "@/lib/composition";
import { TCA_SCALES, tcaColor, type TcaScale } from "@/lib/tcaColors";
import {
  applyPalette,
  contrastRatio,
  fieldHueOf,
  typeHueOf,
  resolveBgHex,
  resolveFgHex,
  effectiveBgRole,
  legalChromaticFg,
  legalGrayFg,
  BG_ROLES,
  FG_ROLES,
  GRAY_BG_STEPS,
  resolveGrayHex,
  TITLE_THRESHOLD,
  type ColorRole,
  type GrayStep,
} from "@/lib/palette";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { X, Check } from "lucide-react";

const HUE_LABEL: Record<TcaScale, string> = {
  gray: "Gray",
  yellow: "Yellow",
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
  yellow: 9,
  red: 9,
  gold: 9,
  green: 9,
  teal: 9,
  blue: 9,
  purple: 9,
};

const ROLE_LABEL: Record<ColorRole, string> = {
  light: "Light",
  brand: "Brand",
  shade: "Shade",
  dark: "Dark",
};

// Neutral names for the three gray steps (no brand/shade concept for gray).
const GRAY_STEP_LABEL: Record<GrayStep, string> = {
  1: "White",
  2: "Off-white",
  12: "Black",
};

// Shared chip classes. Disabled = opacity + not-allowed + hairline border only
// (no X, no overlay) — a true disabled button, matching Radix's disabled read.
function chipClass(legal: boolean, selected: boolean): string {
  return cn(
    "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-shadow",
    !legal
      ? "cursor-not-allowed border-border opacity-50"
      : selected
        ? "border-ring ring-2 ring-ring"
        : "border-border hover:border-foreground/40",
  );
}

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

// A row of chromatic role chips. Illegal roles are truly disabled (opacity + cursor).
function RoleChips({
  roles,
  current,
  swatchOf,
  isLegal,
  onPick,
}: {
  roles: ColorRole[];
  current: ColorRole;
  swatchOf: (role: ColorRole) => string;
  isLegal: (role: ColorRole) => boolean;
  onPick: (role: ColorRole) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {roles.map((role) => {
        const legal = isLegal(role);
        return (
          <button
            key={role}
            type="button"
            disabled={!legal}
            onClick={() => legal && onPick(role)}
            title={ROLE_LABEL[role]}
            className={chipClass(legal, role === current)}
          >
            <span
              className="h-4 w-4 rounded-full border border-black/10"
              style={{ background: swatchOf(role) }}
            />
            <span>{ROLE_LABEL[role]}</span>
          </button>
        );
      })}
    </div>
  );
}

// A row of gray step chips. Illegal steps are truly disabled (same treatment as
// chromatic chips); never a Brand/Shade chip.
function GrayChips({
  steps,
  current,
  isLegal,
  onPick,
}: {
  steps: GrayStep[];
  current: GrayStep;
  isLegal: (step: GrayStep) => boolean;
  onPick: (step: GrayStep) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {steps.map((step) => {
        const legal = isLegal(step);
        return (
          <button
            key={step}
            type="button"
            disabled={!legal}
            onClick={() => legal && onPick(step)}
            title={GRAY_STEP_LABEL[step]}
            className={chipClass(legal, step === current)}
          >
            <span
              className="h-4 w-4 rounded-full border border-black/10"
              style={{ background: resolveGrayHex(step) }}
            />
            <span>{GRAY_STEP_LABEL[step]}</span>
          </button>
        );
      })}
    </div>
  );
}

function ContrastReadout({ label, ratio }: { label: string; ratio: number }) {
  const pass = ratio >= TITLE_THRESHOLD;
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-2.5 py-2">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{ratio.toFixed(1)}:1</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium",
            pass ? "text-success" : "text-muted-foreground",
          )}
        >
          {pass ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
          {pass ? "AA" : "fail"}
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

  // When formula / hue / background changes, re-land title & text (chromatic roles
  // and gray steps) onto their first legal option under the (bridge-aware)
  // legality for the new background.
  const reland = (partial: Partial<PaletteState>) => {
    const merged: PaletteState = { ...p, ...partial };
    const chromFg = legalChromaticFg(merged);
    const titleRole = chromFg.includes(merged.titleRole) ? merged.titleRole : chromFg[0];
    const textRole = chromFg.includes(merged.textRole) ? merged.textRole : chromFg[0];
    const grayFg = legalGrayFg(merged);
    const gt = merged.grayTitleStep ?? 12;
    const gx = merged.grayTextStep ?? 12;
    const grayTitleStep = grayFg.includes(gt) ? gt : (grayFg[0] ?? 12);
    const grayTextStep = grayFg.includes(gx) ? gx : (grayFg[0] ?? 12);
    apply({ ...merged, titleRole, textRole, grayTitleStep, grayTextStep });
  };

  const isMixed = p.formula === "mixed";
  const fieldHue = fieldHueOf(p);
  const typeHue = typeHueOf(p);
  const bgIsGray = fieldHue === "gray";
  const typeIsGray = typeHue === "gray";
  const grayBg = p.grayBgStep ?? 1;

  // Bridge-aware legality + the background's effective role (drives the Brand→Shade
  // substitution, incl. a near-white gray background).
  const effBg = effectiveBgRole(p);
  const chromFgLegal = legalChromaticFg(p);
  const grayFgLegal = legalGrayFg(p);

  // Resolved hexes for the readouts (informational only — not gating).
  const bgHex = bgIsGray ? resolveGrayHex(grayBg) : resolveBgHex(fieldHue, p.bgRole);
  const titleHex = typeIsGray
    ? resolveGrayHex(p.grayTitleStep ?? 12)
    : resolveFgHex(typeHue, effBg, p.titleRole);
  const textHex = typeIsGray
    ? resolveGrayHex(p.grayTextStep ?? 12)
    : resolveFgHex(typeHue, effBg, p.textRole);
  const titleRatio = contrastRatio(bgHex, titleHex);
  const textRatio = contrastRatio(bgHex, textHex);

  // Background chips (chromatic roles or gray steps), always all selectable.
  const backgroundChips = bgIsGray ? (
    <GrayChips
      steps={GRAY_BG_STEPS}
      current={grayBg}
      isLegal={() => true}
      onPick={(step) => reland({ grayBgStep: step })}
    />
  ) : (
    <RoleChips
      roles={BG_ROLES}
      current={p.bgRole}
      swatchOf={(role) => resolveBgHex(fieldHue, role)}
      isLegal={() => true}
      onPick={(role) => reland({ bgRole: role })}
    />
  );

  // Foreground chip row builder (Title / Text), gated by the bridged legality.
  const foregroundChips = (
    role: ColorRole,
    grayStep: GrayStep,
    setRole: (r: ColorRole) => void,
    setGray: (s: GrayStep) => void,
  ) =>
    typeIsGray ? (
      <GrayChips
        steps={GRAY_BG_STEPS}
        current={grayStep}
        isLegal={(s) => grayFgLegal.includes(s)}
        onPick={setGray}
      />
    ) : (
      <RoleChips
        roles={FG_ROLES}
        current={role}
        swatchOf={(r) => resolveFgHex(typeHue, effBg, r)}
        isLegal={(r) => chromFgLegal.includes(r)}
        onPick={setRole}
      />
    );

  return (
    <div className="space-y-5">
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

      {/* Mono: one shared hue picker governs both blocks below */}
      {!isMixed && <HuePicker label="Hue" value={p.hueA} onChange={(v) => reland({ hueA: v })} />}

      {/* Background block */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground">Background</Label>
        {isMixed && (
          <HuePicker label="Background hue" value={p.hueB} onChange={(v) => reland({ hueB: v })} />
        )}
        {backgroundChips}
      </div>

      {/* Type block */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground">Type</Label>
        {isMixed && (
          <HuePicker label="Type hue" value={p.hueA} onChange={(v) => reland({ hueA: v })} />
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Title</Label>
          {foregroundChips(
            p.titleRole,
            p.grayTitleStep ?? 12,
            (r) => apply({ ...p, titleRole: r }),
            (s) => apply({ ...p, grayTitleStep: s }),
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          {foregroundChips(
            p.textRole,
            p.grayTextStep ?? 12,
            (r) => apply({ ...p, textRole: r }),
            (s) => apply({ ...p, grayTextStep: s }),
          )}
        </div>
      </div>

      {/* Live contrast readouts — informational only, not gating */}
      <div className="space-y-1.5">
        <ContrastReadout label="Title on background" ratio={titleRatio} />
        <ContrastReadout label="Text on background" ratio={textRatio} />
      </div>
    </div>
  );
}
