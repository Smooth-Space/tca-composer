import type { Composition, Format, Mode, Template, SplitOrder } from "@/lib/composition";
import { TEMPLATE_CAPTIONS, TEMPLATE_VARIANTS } from "@/lib/composition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Plus, X, Shuffle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { newSeed } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { useRef } from "react";

interface Props {
  comp: Composition;
  setComp: React.Dispatch<React.SetStateAction<Composition>>;
  onExport: () => void;
  exporting: boolean;
}

const FORMATS: Format[] = ["1:1", "4:5", "9:16"];
const MODES: Mode[] = ["light", "mixed", "heavy"];
const TEMPLATES: Template[] = ["A", "B", "C", "D"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
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

export function ControlPanel({ comp, setComp, onExport, exporting }: Props) {
  const update = (patch: Partial<Composition>) => setComp((c) => ({ ...c, ...patch }));
  const fileRef = useRef<HTMLInputElement>(null);
  const multiFileRef = useRef<HTMLInputElement>(null);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      update({
        images: [
          {
            id: comp.images[0]?.id ?? crypto.randomUUID(),
            src: url,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          },
        ],
      });
    };
    img.src = url;
    e.target.value = "";
  };

  const onUploadMulti = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    Promise.all(
      files.map(
        (file) =>
          new Promise<{ id: string; src: string; naturalWidth: number; naturalHeight: number }>(
            (resolve) => {
              const url = URL.createObjectURL(file);
              const img = new Image();
              img.onload = () =>
                resolve({
                  id: crypto.randomUUID(),
                  src: url,
                  naturalWidth: img.naturalWidth,
                  naturalHeight: img.naturalHeight,
                });
              img.src = url;
            },
          ),
      ),
    ).then((items) => {
      setComp((c) => ({ ...c, images: [...c.images, ...items].slice(0, 6) }));
    });
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-background p-5">
      <h1 className="text-lg font-semibold">Composer</h1>

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
      </Section>

      <Section title="Variant">
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
      </Section>

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

      {(comp.variant === "split" ||
        comp.variant === "full" ||
        comp.variant === "inset") && (
        <Section title="Image">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onUpload}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <img
              src={comp.images[0]?.src ?? "/placeholder.jpg"}
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
          {comp.variant === "split" && (
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
        </Section>
      )}

      {comp.variant === "multi" && (
        <Section title="Images">
          <input
            ref={multiFileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onUploadMulti}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={comp.images.length >= 6}
              onClick={() => multiFileRef.current?.click()}
            >
              <Plus className="mr-1 h-4 w-4" /> Add images
            </Button>
            <Button variant="outline" size="sm" onClick={() => update({ multiSeed: newSeed() })}>
              <Shuffle className="mr-1 h-4 w-4" /> Reroll layout
            </Button>
          </div>
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
        </Section>
      )}

      <Section title="Colors">
        <div className="grid grid-cols-3 gap-3">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Text</Label>
            <input
              type="color"
              value={comp.textColor}
              onChange={(e) => update({ textColor: e.target.value })}
              className="h-9 w-full cursor-pointer rounded-md border border-input bg-background"
            />
          </div>
        </div>
      </Section>

      <Section title="Titles">
        <div className="space-y-2">
          <Label className="text-xs">Mode</Label>
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={comp.titleMode === "mixed"}
                    onClick={() => update({ titleSeed: newSeed() })}
                  >
                    <Shuffle className="mr-1 h-4 w-4" /> Reroll type
                  </Button>
                </span>
              </TooltipTrigger>
              {comp.titleMode === "mixed" && (
                <TooltipContent>No randomness in Mixed mode</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {comp.template === "D" ? (
          <div className="space-y-2">
            {[0, 1].map((idx) => {
              const t = comp.titles[idx];
              const label = idx === 0 ? "Title 1 (top)" : "Title 2 (bottom)";
              return (
                <div key={idx} className="space-y-1">
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
        <div className="space-y-2">
          {comp.titles.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
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
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add title row
          </Button>
        </div>
        )}

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Size</Label>
            <span className="text-xs text-muted-foreground">{comp.titleSizePx}px</span>
          </div>
          <Slider
            min={48}
            max={240}
            step={1}
            value={[comp.titleSizePx]}
            onValueChange={([v]) => update({ titleSizePx: v })}
          />
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
      </Section>
    </aside>
  );
}