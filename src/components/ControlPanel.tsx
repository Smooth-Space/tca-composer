import type { Composition, Format, Mode, Template, SplitOrder, CaptionKey } from "@/lib/composition";
import { TEMPLATE_CAPTIONS, TEMPLATE_VARIANTS, PLACEHOLDER_SRC } from "@/lib/composition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Plus, X, RefreshCw, ChevronDown } from "lucide-react";
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

export function ControlPanel({ comp, setComp, onExport, exporting, onReset }: Props) {
  const update = (patch: Partial<Composition>) => setComp((c) => ({ ...c, ...patch }));
  const fileRef = useRef<HTMLInputElement>(null);
  const multiFileRef = useRef<HTMLInputElement>(null);

  const usesImage =
    comp.variant === "split" || comp.variant === "full" || comp.variant === "inset";

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
      setComp((c) => ({ ...c, images: [...c.images, ...items].slice(0, 6) }));
    });
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-background p-5">
      <h1 className="text-lg font-semibold">Composer</h1>

      <Section title="Format">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => update({ format: f })}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition-colors",
                comp.format === f
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Template">
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
          {TEMPLATES.map((t) => (
            <button
              key={t}
              onClick={() =>
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
                  return {
                    ...c,
                    template: t,
                    titles,
                    variant: TEMPLATE_VARIANTS[t].includes(c.variant) ? c.variant : "none",
                  };
                })
              }
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition-colors",
                comp.template === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Variant</Label>
            {comp.variant === "multi" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => update({ multiSeed: newSeed() })}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Reroll layout</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
            {TEMPLATE_VARIANTS[comp.template].map((v) => (
              <button
                key={v}
                onClick={() => update({ variant: v })}
                className={cn(
                  "rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
                  comp.variant === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {usesImage && (
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
            {comp.variant === "split" && comp.template !== "B" && (
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {(["image-first", "title-first"] as SplitOrder[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => update({ splitOrder: o })}
                    className={cn(
                      "rounded-md py-1 text-xs font-medium transition-colors",
                      comp.splitOrder === o
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o === "image-first" ? "Image first" : "Title first"}
                  </button>
                ))}
              </div>
            )}
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
              disabled={comp.images.length >= 6}
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
          <div className="space-y-1.5">
            <Label className="text-xs">Background</Label>
            <input
              type="color"
              value={comp.background}
              onChange={(e) => update({ background: e.target.value })}
              className="h-9 w-full cursor-pointer rounded-md border border-input bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <input
              type="color"
              value={comp.titleColor}
              onChange={(e) => update({ titleColor: e.target.value })}
              className="h-9 w-full cursor-pointer rounded-md border border-input bg-background"
            />
          </div>
          {TEMPLATE_CAPTIONS[comp.template].map((slot) => (
            <div key={slot.key} className="space-y-1.5">
              <Label className="text-xs">{slot.label} color</Label>
              <input
                type="color"
                value={comp.captionColors[slot.key as CaptionKey]}
                onChange={(e) =>
                  update({
                    captionColors: { ...comp.captionColors, [slot.key]: e.target.value },
                  })
                }
                className="h-9 w-full cursor-pointer rounded-md border border-input bg-background"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Titles">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Mode</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={comp.titleMode === "mixed"}
                      onClick={() => update({ titleSeed: newSeed() })}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {comp.titleMode === "mixed" ? "No randomness in Mixed mode" : "Reroll type"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => update({ titleMode: m, titleSeed: newSeed() })}
                className={cn(
                  "rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
                  comp.titleMode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>
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
                  <Input
                    value={t?.text ?? ""}
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
            {comp.titles.map((t, idx) => (
              <div
                key={t.id}
                className={cn(
                  "flex items-center gap-2",
                  idx > 0 && "border-t border-border pt-5",
                )}
              >
                <Input
                  value={t.text}
                  onChange={(e) =>
                    update({
                      titles: comp.titles.map((x) =>
                        x.id === t.id ? { ...x, text: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() =>
                    update({ titles: comp.titles.filter((x) => x.id !== t.id) })
                  }
                  disabled={comp.titles.length <= 1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                update({
                  titles: [
                    ...comp.titles,
                    { id: crypto.randomUUID(), text: "New title" },
                  ],
                  // Fit only applies to a single line; revert when a 2nd line appears.
                  titleSizeMode: "fixed",
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add title row
            </Button>
          </div>
        )}

        {comp.template !== "D" && comp.titles.length >= 2 && (
          <div className="flex items-center justify-between pt-3">
            <Label className="text-xs">Shift lines</Label>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={!comp.titleShift}
                        onClick={() => update({ titleShiftSeed: newSeed() })}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {comp.titleShift ? "Reroll shift" : "Turn shift on to reroll"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
            {comp.template !== "D" && comp.titles.length === 1 && (
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
          {comp.titleSizeMode === "fit" && comp.template !== "D" && comp.titles.length === 1 ? (
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
