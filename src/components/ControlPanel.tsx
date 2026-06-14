import type { Composition, Format, Mode, Variant, SplitOrder } from "@/lib/composition";
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
}

const FORMATS: Format[] = ["1:1", "4:5", "9:16"];
const MODES: Mode[] = ["light", "mixed", "heavy"];
const VARIANTS: Variant[] = ["none", "split", "full"];

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

export function ControlPanel({ comp, setComp }: Props) {
  const update = (patch: Partial<Composition>) => setComp((c) => ({ ...c, ...patch }));
  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    update({ images: [{ id: comp.images[0]?.id ?? crypto.randomUUID(), src: url }] });
    e.target.value = "";
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-background p-5">
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

      <Section title="Variant">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {VARIANTS.map((v) => (
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

      {(comp.variant === "split" || comp.variant === "full") && (
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
          {comp.titles.map((t) => (
            <div key={t.id} className="space-y-2">
              <div className="flex items-center gap-2">
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
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {(["upper", "sentence"] as TitleCase[]).map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      update({
                        titles: comp.titles.map((x) =>
                          x.id === t.id ? { ...x, case: c } : x,
                        ),
                      })
                    }
                    className={cn(
                      "rounded-md py-1 text-xs font-medium transition-colors",
                      t.case === c
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c === "upper" ? "UPPER" : "Sentence"}
                  </button>
                ))}
              </div>
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
                  { id: crypto.randomUUID(), text: "New title", case: "upper" },
                ],
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add title row
          </Button>
        </div>

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

        <div className="space-y-2 pt-1">
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
      </Section>

      <Section title="Text">
        <div className="space-y-2">
          <AutoTextarea
            value={comp.info.text1}
            onChange={(e) => update({ info: { ...comp.info, text1: e.target.value } })}
            placeholder="Text 1"
            rows={2}
            className="resize-none"
          />
          <AutoTextarea
            value={comp.info.text2}
            onChange={(e) => update({ info: { ...comp.info, text2: e.target.value } })}
            placeholder="Text 2"
            rows={2}
            className="resize-none"
          />
        </div>
      </Section>
    </aside>
  );
}