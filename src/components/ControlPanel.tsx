import type { Composition, Format, Mode, Template, SplitOrder, CaptionKey } from "@/lib/composition";
import { TEMPLATE_CAPTIONS, TEMPLATE_VARIANTS, PLACEHOLDER_SRC } from "@/lib/composition";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Plus, X, RefreshCw, ChevronDown, Play, Pause } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { newSeed } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { useRef } from "react";

interface Props {
  comp: Composition;
  setComp: React.Dispatch<React.SetStateAction<Composition>>;
  onExport: () => void;
  exporting: boolean;
  onReset: () => void;
  onExportMp4?: () => void;
  exportingMp4?: boolean;
  mp4Progress?: number;
}

const FORMATS: Format[] = ["1:1", "4:5", "9:16"];
const MODES: Mode[] = ["light", "mixed", "heavy"];
const TEMPLATES: Template[] = ["A", "B", "C", "D"];

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

function AutoTextarea(props: React.ComponentProps<typeof Textarea>) {
  const ref = useRef<HTMLTextAreaElement>(null);
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
      onFocus={(e) => grow(e.currentTarget)}
    />
  );
}

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
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
}: Props) {
  const update = (patch: Partial<Composition>) => setComp((c) => ({ ...c, ...patch }));
  const fileRef = useRef<HTMLInputElement>(null);
  const multiFileRef = useRef<HTMLInputElement>(null);
  const splitFileRef = useRef<HTMLInputElement>(null);

  const usesImage = comp.variant === "split" || comp.variant === "full";
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

      <Section title="Format">
        <SegmentedControl
          options={FORMATS}
          value={comp.format}
          onChange={(f) => update({ format: f })}
          columns={3}
        />
      </Section>

      <Section title="Template">
        <SegmentedControl
          options={TEMPLATES}
          value={comp.template}
          columns={4}
          onChange={(t) =>
            setComp((c) => {
              let titles = c.titles;
              if (t === "D" && titles.length < 2) {
                const defaults = ["Title one", "Title two"];
                titles = [...titles];
                while (titles.length < 2) {
                  titles.push({
                    id: crypto.randomUUID(),
                    text: defaults[titles.length] ?? "New title",
                  });
                }
              }
              if (t !== "D" && titles.length > 1) {
                titles = [{ id: titles[0].id, text: titles.map((x) => x.text).join("\n") }];
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
      </Section>

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

      <Section title="Titles">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Mode</Label>
            <RerollButton
              disabled={comp.titleMode === "mixed"}
              onClick={() => update({ titleSeed: newSeed() })}
              tooltip={comp.titleMode === "mixed" ? "No randomness in Mixed mode" : "Reroll type"}
            />
          </div>
          <SegmentedControl
            options={MODES}
            value={comp.titleMode}
            onChange={(m) => update({ titleMode: m, titleSeed: newSeed() })}
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
      </Section>

      <Section title="Text">
        <div className="space-y-2">
          {TEMPLATE_CAPTIONS[comp.template].map((slot) => (
            <div key={slot.key} className="space-y-1">
              <Label className="text-xs">{slot.label}</Label>
              <AutoTextarea
                value={comp.captions[slot.key]}
                onChange={(e) =>
                  update({ captions: { ...comp.captions, [slot.key]: e.target.value } })
                }
                placeholder={slot.label}
                rows={2}
                className="resize-none"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Export">
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
