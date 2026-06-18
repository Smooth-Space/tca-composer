import type { Composition, Format, Mode, Template, SplitOrder, CaptionKey } from "@/lib/composition";
import { TEMPLATE_CAPTIONS, TEMPLATE_VARIANTS, PLACEHOLDER_SRC } from "@/lib/composition";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Plus, X, RefreshCw, ChevronDown, Play, Pause, Eye, EyeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { newSeed, resolveWave } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { forwardRef, useEffect, useRef } from "react";

interface Props {
  comp: Composition;
  setComp: React.Dispatch<React.SetStateAction<Composition>>;
  onExport: () => void;
  exporting: boolean;
  onReset: () => void;
  onExportMp4?: () => void;
  exportingMp4?: boolean;
  mp4Progress?: number;
  onExportSvg?: () => void;
  selectedTitleId?: string | null;
  onSelectTitle?: (id: string | null) => void;
  focusReq?: { id: string | null; mode: "end" | "all"; nonce: number };
}

const FORMATS: Format[] = ["1:1", "4:5", "9:16"];
const MODES: Mode[] = ["light", "mixed", "heavy"];
const TEMPLATES: Template[] = ["A", "B", "C", "D", "freeform"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function loadDimensions(src: string): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
    img.onerror = () => res({ naturalWidth: 0, naturalHeight: 0 });
    img.src = src;
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible defaultOpen className="rounded-lg border border-border bg-card">
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 px-4 pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const AutoTextarea = forwardRef<HTMLTextAreaElement, React.ComponentProps<typeof Textarea>>(
  function AutoTextarea({ onFocus, ...props }, ref) {
    const grow = (el: HTMLTextAreaElement | null) => {
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    return (
      <Textarea
        {...props}
        ref={ref}
        onInput={(e) => grow(e.currentTarget)}
        onFocus={(e) => {
          grow(e.currentTarget);
          onFocus?.(e);
        }}
      />
    );
  },
);

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  columns,
  getLabel,
  size = "md",
  capitalize = false,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  columns: number;
  getLabel?: (v: T) => string;
  size?: "sm" | "md";
  capitalize?: boolean;
}) {
  return (
    <div className={cn("grid gap-1 rounded-lg bg-muted p-1", GRID_COLS[columns])}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "py-1 text-xs" : "py-1.5 text-sm",
            capitalize && "capitalize",
            value === o
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {getLabel ? getLabel(o) : o}
        </button>
      ))}
    </div>
  );
}

function RerollButton({
  onClick,
  disabled,
  tooltip,
}: {
  onClick: () => void;
  disabled?: boolean;
  tooltip: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={disabled}
              onClick={onClick}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full cursor-pointer rounded-md border border-input bg-background"
      />
    </div>
  );
}

export function ControlPanel({
  comp,
  setComp,
  onExport,
  exporting,
  onReset,
  onExportMp4,
  exportingMp4,
  mp4Progress,
  onExportSvg,
  selectedTitleId,
  onSelectTitle,
  focusReq,
}: Props) {
  const update = (patch: Partial<Composition>) => setComp((c) => ({ ...c, ...patch }));
  const fileRef = useRef<HTMLInputElement>(null);
  const multiFileRef = useRef<HTMLInputElement>(null);
  const splitFileRef = useRef<HTMLInputElement>(null);
  const titleRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  useEffect(() => {
    if (!focusReq?.id) return;
    const el = titleRefs.current.get(focusReq.id);
    if (!el) return;
    el.focus();
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (focusReq.mode === "all") el.select();
    else {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReq?.nonce]);

  const usesImage = comp.variant === "split" || comp.variant === "full";
  const isFreeform = comp.template === "freeform";
  const lineCount =
    comp.template === "D" ? 0 : comp.titles[0]?.text.split("\n").length ?? 1;

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    (async () => {
      const url = await fileToDataUrl(file);
      const { naturalWidth, naturalHeight } = await loadDimensions(url);
      update({
        images: [
          {
            id: comp.images[0]?.id ?? crypto.randomUUID(),
            src: url,
            naturalWidth,
            naturalHeight,
          },
        ],
      });
    })();
  };

  const onUploadMulti = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    Promise.all(
      files.map(
        async (file) => {
          const url = await fileToDataUrl(file);
          const { naturalWidth, naturalHeight } = await loadDimensions(url);
          return { id: crypto.randomUUID(), src: url, naturalWidth, naturalHeight };
        },
      ),
    ).then((items) => {
      setComp((c) => ({ ...c, images: [...c.images, ...items] }));
    });
  };

  const onUploadSplit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    Promise.all(
      files.map(async (file) => {
        const url = await fileToDataUrl(file);
        const { naturalWidth, naturalHeight } = await loadDimensions(url);
        return { id: crypto.randomUUID(), src: url, naturalWidth, naturalHeight };
      }),
    ).then((items) => {
      setComp((c) => ({ ...c, images: [...c.images, ...items].slice(0, 5) }));
    });
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-background p-5">
      <h1 className="text-lg font-semibold">Composer</h1>

      {!isFreeform && (
      <Section title="Format">
        <SegmentedControl
          options={FORMATS}
          value={comp.format}
          onChange={(f) => update({ format: f })}
          columns={3}
        />
      </Section>
      )}

      <Section title="Template">
        <SegmentedControl
          options={TEMPLATES}
          value={comp.template}
          columns={5}
          getLabel={(t) => (t === "freeform" ? "Free" : t)}
          onChange={(t) =>
            setComp((c) => {
              let titles = c.titles;
              if (t === "D") {
                titles = [...titles];
                while (titles.length < 2) {
                  titles.push({ id: crypto.randomUUID(), text: "" });
                }
                if (titles.length > 2) titles.length = 2;
              }
              return {
                ...c,
                template: t,
                titles,
                variant: TEMPLATE_VARIANTS[t].includes(c.variant) ? c.variant : "none",
              };
            })
          }
        />

        {!isFreeform && (
        <>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Variant</Label>
            {comp.variant === "multi" && (
              <RerollButton
                onClick={() => update({ multiSeed: newSeed() })}
                tooltip="Reroll layout"
              />
            )}
          </div>
          <SegmentedControl
            options={TEMPLATE_VARIANTS[comp.template]}
            value={comp.variant}
            onChange={(v) => update({ variant: v })}
            columns={4}
            capitalize
          />
        </div>

        {comp.variant === "full" && (
          <div className="space-y-3 pt-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onUpload}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <img
                src={comp.images[0]?.src ?? PLACEHOLDER_SRC}
                alt=""
                className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
              />
              <div className="flex flex-1 flex-col gap-1.5">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Upload / Replace
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!comp.images[0]}
                  onClick={() => update({ images: [] })}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}

        {comp.variant === "split" && (
          <div className="space-y-3 pt-1">
            <input
              ref={splitFileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onUploadSplit}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={comp.images.length >= 5}
              onClick={() => splitFileRef.current?.click()}
            >
              <Plus className="mr-1 h-4 w-4" /> Add images ({comp.images.length}/5)
            </Button>
            {comp.images.length > 0 && (
              <div className="space-y-2">
                {comp.images.map((im, i) => (
                  <div key={im.id} className="flex items-center gap-2">
                    <img
                      src={im.src}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                    />
                    <span className="flex-1 text-xs text-muted-foreground">
                      {i === 0 ? "First (static)" : `Image ${i + 1}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() =>
                        update({ images: comp.images.filter((x) => x.id !== im.id) })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {(comp.template === "A" || comp.template === "B") && (
              <SegmentedControl
                options={["image-first", "title-first"] as SplitOrder[]}
                value={comp.splitOrder}
                onChange={(o) => update({ splitOrder: o })}
                columns={2}
                size="sm"
                getLabel={(o) => (o === "image-first" ? "Image first" : "Title first")}
              />
            )}
            <div className="flex items-center justify-between pt-1">
              <Label className="text-xs">Animate</Label>
              <div className="flex items-center gap-1">
                {comp.animate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => update({ animPlaying: !comp.animPlaying })}
                  >
                    {comp.animPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Switch
                  checked={comp.animate}
                  onCheckedChange={(v) => update({ animate: v })}
                />
              </div>
            </div>
          </div>
        )}

        {comp.variant === "multi" && (
          <div className="space-y-3 pt-1">
            <input
              ref={multiFileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onUploadMulti}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => multiFileRef.current?.click()}
            >
              <Plus className="mr-1 h-4 w-4" /> Add images
            </Button>
            {comp.images.length > 0 && (
              <div className="space-y-2">
                {comp.images.map((im, i) => (
                  <div key={im.id} className="flex items-center gap-2">
                    <img
                      src={im.src}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                    />
                    <span className="flex-1 text-xs text-muted-foreground">
                      {i < 3 ? `Shown ${i + 1}` : "Stored (not shown)"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() =>
                        update({ images: comp.images.filter((x) => x.id !== im.id) })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <Label className="text-xs">Animate</Label>
              <div className="flex items-center gap-1">
                {comp.animate && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => update({ animPlaying: !comp.animPlaying })}
                    >
                      {comp.animPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <RerollButton
                      onClick={() => update({ animSeed: newSeed() })}
                      tooltip="Reroll animation"
                    />
                  </>
                )}
                <Switch
                  checked={comp.animate}
                  onCheckedChange={(v) => update({ animate: v })}
                />
              </div>
            </div>
            {comp.animate && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Globe size</Label>
                  <span className="text-xs text-muted-foreground">
                    {comp.globeScale.toFixed(2)}×
                  </span>
                </div>
                <Slider
                  min={1.0}
                  max={2.0}
                  step={0.05}
                  value={[comp.globeScale]}
                  onValueChange={([v]) => update({ globeScale: v })}
                />
              </div>
            )}
          </div>
        )}

        {(usesImage || comp.variant === "multi") && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Image overlay</Label>
              <span className="text-xs text-muted-foreground">
                {Math.round(comp.imageOverlay * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[Math.round(comp.imageOverlay * 100)]}
              onValueChange={([v]) => update({ imageOverlay: v / 100 })}
            />
          </div>
        )}
        </>
        )}
      </Section>

      {!isFreeform && (
      <Section title="Colors">
        <div className="grid grid-cols-2 gap-3">
          <ColorField
            label="Background"
            value={comp.background}
            onChange={(v) => update({ background: v })}
          />
          <ColorField
            label="Title"
            value={comp.titleColor}
            onChange={(v) => update({ titleColor: v })}
          />
          {TEMPLATE_CAPTIONS[comp.template].map((slot) => (
            <ColorField
              key={slot.key}
              label={`${slot.label} color`}
              value={comp.captionColors[slot.key as CaptionKey]}
              onChange={(v) =>
                update({
                  captionColors: { ...comp.captionColors, [slot.key]: v },
                })
              }
            />
          ))}
        </div>
      </Section>
      )}

      <Section title="Titles">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Mode</Label>
            <RerollButton
              disabled={comp.titleMode === "mixed"}
              onClick={() => update({ titleSeed: newSeed(), titleAmplitude: null, titlePhase: null })}
              tooltip={comp.titleMode === "mixed" ? "No randomness in Mixed mode" : "Reroll type"}
            />
          </div>
          <SegmentedControl
            options={MODES}
            value={comp.titleMode}
            onChange={(m) =>
              update({ titleMode: m, titleSeed: newSeed(), titleAmplitude: null, titlePhase: null })
            }
            columns={3}
            capitalize
          />
        </div>

        {comp.template === "D" ? (
          <div className="space-y-5 pt-5">
            {[0, 1].map((idx) => {
              const t = comp.titles[idx];
              const label = idx === 0 ? "Title 1 (top)" : "Title 2 (bottom)";
              return (
                <div
                  key={idx}
                  className={cn("space-y-1", idx > 0 && "border-t border-border pt-5")}
                >
                  <Label className="text-xs">{label}</Label>
                  <AutoTextarea
                    value={t?.text ?? ""}
                    rows={1}
                    ref={(el) => {
                      const id = comp.titles[idx]?.id;
                      if (el && id) titleRefs.current.set(id, el);
                    }}
                    onFocus={() => onSelectTitle?.(comp.titles[idx]?.id ?? null)}
                    onChange={(e) =>
                      setComp((c) => {
                        const titles = [...c.titles];
                        while (titles.length < 2) {
                          titles.push({ id: crypto.randomUUID(), text: "" });
                        }
                        titles[idx] = { ...titles[idx], text: e.target.value };
                        return { ...c, titles };
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-5 pt-5">
            <AutoTextarea
              value={comp.titles[0]?.text ?? ""}
              rows={1}
              ref={(el) => {
                const id = comp.titles[0]?.id;
                if (el && id) titleRefs.current.set(id, el);
              }}
              onFocus={() => onSelectTitle?.(comp.titles[0]?.id ?? null)}
              onChange={(e) =>
                setComp((c) => {
                  const first = c.titles[0] ?? { id: crypto.randomUUID(), text: "" };
                  return { ...c, titles: [{ ...first, text: e.target.value }] };
                })
              }
            />
          </div>
        )}

        {comp.template !== "D" && lineCount >= 2 && (
          <div className="flex items-center justify-between pt-3">
            <Label className="text-xs">Shift lines</Label>
            <div className="flex items-center gap-1">
              <RerollButton
                disabled={!comp.titleShift}
                onClick={() => update({ titleShiftSeed: newSeed() })}
                tooltip={comp.titleShift ? "Reroll shift" : "Turn shift on to reroll"}
              />
              <Switch
                checked={comp.titleShift}
                onCheckedChange={(v) =>
                  update({ titleShift: v, ...(v ? { titleShiftSeed: newSeed() } : {}) })
                }
              />
            </div>
          </div>
        )}

        <div className="space-y-2 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Size</Label>
            {comp.template !== "D" && lineCount === 1 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Fit width</Label>
                <Switch
                  checked={comp.titleSizeMode === "fit"}
                  onCheckedChange={(v) =>
                    update({ titleSizeMode: v ? "fit" : "fixed" })
                  }
                />
              </div>
            )}
          </div>
          {comp.titleSizeMode === "fit" && comp.template !== "D" && lineCount === 1 ? (
            <p className="text-xs text-muted-foreground">Auto-scaled to fit the width.</p>
          ) : (
            <>
              <div className="flex items-center justify-end">
                <span className="text-xs text-muted-foreground">{comp.titleSizePx}px</span>
              </div>
              <Slider
                min={48}
                max={240}
                step={1}
                value={[comp.titleSizePx]}
                onValueChange={([v]) => update({ titleSizePx: v })}
              />
            </>
          )}
        </div>

        <AdvancedWave comp={comp} update={update} />
      </Section>

      {!isFreeform && (
      <Section title="Text">
        <div className="space-y-2">
          {TEMPLATE_CAPTIONS[comp.template].map((slot) => {
            const isEmpty = (comp.captions[slot.key] ?? "") === "";
            const hidden = comp.captionHidden[slot.key];
            return (
              <div key={slot.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{slot.label}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={!isEmpty}
                            onClick={() =>
                              update({
                                captionHidden: { ...comp.captionHidden, [slot.key]: !hidden },
                              })
                            }
                          >
                            {hidden ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!isEmpty
                          ? "Clear the text to hide this field"
                          : hidden
                            ? "Show field"
                            : "Hide field"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <AutoTextarea
                  value={comp.captions[slot.key]}
                  onChange={(e) =>
                    update({ captions: { ...comp.captions, [slot.key]: e.target.value } })
                  }
                  placeholder={slot.label}
                  rows={2}
                  className={cn("resize-none", hidden && "opacity-50")}
                  ref={(el) => {
                    if (el) titleRefs.current.set(slot.key, el);
                  }}
                  onFocus={() => onSelectTitle?.(slot.key)}
                />
              </div>
            );
          })}
        </div>
      </Section>
      )}

      <Section title="Export">
        {isFreeform ? (
          <Button className="w-full" onClick={onExportSvg}>
            Export SVG
          </Button>
        ) : (
          <>
            <Button className="w-full" onClick={onExport} disabled={exporting}>
              {exporting ? "Exporting…" : "Export JPG"}
            </Button>
            {(comp.variant === "multi" || comp.variant === "split") && comp.animate && (
              <Button className="w-full" onClick={onExportMp4} disabled={exportingMp4}>
                {exportingMp4
                  ? `Exporting MP4… ${Math.round((mp4Progress ?? 0) * 100)}%`
                  : "Export MP4"}
              </Button>
            )}
          </>
        )}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            if (window.confirm("Reset to a new composition? This clears your saved work.")) {
              onReset();
            }
          }}
        >
          Reset / New
        </Button>
      </Section>
    </aside>
  );
}

function DistributionViz({
  mode,
  amplitude,
  phase,
}: {
  mode: Mode;
  amplitude: number;
  phase: number;
}) {
  const W = 240,
    H = 72,
    pad = 6,
    N = 64;
  const linear = mode === "mixed";
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N;
    const d = linear ? t : (Math.sin(2 * Math.PI * (amplitude * t + phase)) + 1) / 2;
    const x = pad + t * (W - 2 * pad);
    const y = H - pad - d * (H - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="rounded-md border bg-muted/30 text-foreground"
    >
      <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke="currentColor" strokeOpacity={0.15} />
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function AdvancedWave({
  comp,
  update,
}: {
  comp: Composition;
  update: (patch: Partial<Composition>) => void;
}) {
  const wave = resolveWave(comp.titleMode, comp.titleSeed);
  const amp = comp.titleAmplitude ?? wave.amplitude;
  const ph = comp.titlePhase ?? wave.phase;
  const isLinear = comp.titleMode === "mixed";
  return (
    <Collapsible className="pt-3">
      <CollapsibleTrigger className="group flex w-full items-center justify-between text-xs text-muted-foreground">
        Advanced
        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-3">
        <TooltipProvider>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Amplitude</Label>
              <span className="text-xs text-muted-foreground">{amp.toFixed(1)}×</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <Slider
                    min={0}
                    max={4}
                    step={0.1}
                    value={[amp]}
                    disabled={isLinear}
                    onValueChange={([v]) => update({ titleAmplitude: v })}
                  />
                </span>
              </TooltipTrigger>
              {isLinear && (
                <TooltipContent>Amplitude applies to Light/Heavy (Mixed is linear)</TooltipContent>
              )}
            </Tooltip>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Phase</Label>
              <span className="text-xs text-muted-foreground">{ph.toFixed(2)}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[ph]}
                    disabled={isLinear}
                    onValueChange={([v]) => update({ titlePhase: v })}
                  />
                </span>
              </TooltipTrigger>
              {isLinear && (
                <TooltipContent>Phase applies to Light/Heavy (Mixed is linear)</TooltipContent>
              )}
            </Tooltip>
          </div>
        </TooltipProvider>
        <DistributionViz mode={comp.titleMode} amplitude={amp} phase={ph} />
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => update({ titleAmplitude: null, titlePhase: null, titleSeed: newSeed() })}
        >
          Reset to random
        </button>
      </CollapsibleContent>
    </Collapsible>
  );
}
