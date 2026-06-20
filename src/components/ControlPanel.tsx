import type {
  Composition,
  Format,
  Mode,
  Template,
  SplitOrder,
  SplitStyle,
  CaptionKey,
} from "@/lib/composition";
import { TEMPLATE_CAPTIONS, TEMPLATE_VARIANTS, PLACEHOLDER_COLOR } from "@/lib/composition";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Plus, X, RefreshCw, ChevronDown, Play, Pause, Eye, EyeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { newSeed, resolveWave } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { PaletteControls } from "@/components/PaletteControls";
import { forwardRef, useEffect, useRef, useState } from "react";

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

const FORMATS: Format[] = ["1:1", "4:5", "9:16", "3:2"];
const MODES: Mode[] = ["light", "mixed", "heavy"];
const TEMPLATES: Template[] = ["freeform", "A", "B", "D"];

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

function Wordmark() {
  return (
    <svg
      width="158"
      height="20"
      viewBox="0 0 150 19"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="The Contemporary Austin"
      style={{ display: "block", width: 158, height: 20, flexShrink: 0 }}
    >
      <path d="M16.0892 14.607V7.20733C16.0892 6.33046 15.4839 5.90051 14.7824 5.90051H14.3354C13.7301 5.90051 13.1078 6.19468 12.7175 6.65858V14.607H10.2849V0H12.7175V4.44094C13.3624 3.99402 14.0809 3.73944 14.8389 3.73944H15.58C17.4526 3.73944 18.5218 5.23861 18.5218 6.99236V14.607H16.0892Z" fill="#121212" />
      <path d="M22.6856 8.26017H26.2101V7.2645C26.2101 6.38762 25.5878 5.9011 24.8467 5.9011H24.049C23.3079 5.9011 22.6856 6.38762 22.6856 7.2645V8.26017ZM22.6856 10.1667V11.2019C22.6856 12.0788 23.3079 12.5653 24.049 12.5653H24.8467C25.5878 12.5653 26.2101 12.0788 26.2101 11.2189V11.1793H28.6427V11.5131C28.6427 13.2046 27.3585 14.7264 25.2144 14.7264H23.834C21.5937 14.7264 20.2473 13.1876 20.2473 11.4905V7.02689C20.2473 5.29577 21.5937 3.73438 23.834 3.73438H25.2144C27.3585 3.73438 28.6427 5.29577 28.6427 7.02689V10.161H22.6799L22.6856 10.1667Z" fill="#121212" />
      <path d="M43.2553 9.97495V11.6495C43.2553 13.2448 41.8523 14.727 39.5158 14.727H37.4113C34.9957 14.727 33.5361 13.2448 33.5361 11.6495V3.91604C33.5361 2.3207 34.9957 0.855469 37.4113 0.855469H39.5158C41.8523 0.855469 43.2553 2.31504 43.2553 3.91604V5.55098H40.7435V4.45913C40.7435 3.58226 40.0589 3.09574 39.2217 3.09574H37.5471C36.7268 3.09574 36.0649 3.58226 36.0649 4.45913V11.1234C36.0649 12.0002 36.7268 12.4868 37.5471 12.4868H39.2217C40.0589 12.4868 40.7435 12.0002 40.7435 11.1234V9.97495H43.2553Z" fill="#121212" />
      <path d="M49.3255 12.5636C50.0666 12.5636 50.6889 12.0771 50.6889 11.2002V7.2684C50.6889 6.39153 50.0666 5.90501 49.3255 5.90501H48.5279C47.7868 5.90501 47.1645 6.39153 47.1645 7.2684V11.2002C47.1645 12.0771 47.7868 12.5636 48.5279 12.5636H49.3255ZM48.3129 14.7247C46.0726 14.7247 44.7262 13.1859 44.7262 11.4944V7.0308C44.7262 5.29968 46.0726 3.73828 48.3129 3.73828H49.6933C51.8374 3.73828 53.1216 5.29968 53.1216 7.0308V11.4944C53.1216 13.1859 51.8374 14.7247 49.6933 14.7247H48.3129Z" fill="#121212" />
      <path d="M60.855 14.6058V7.20617C60.855 6.3293 60.2497 5.89935 59.5482 5.89935H59.1012C58.4959 5.89935 57.8736 6.19353 57.4833 6.65742V14.6058H55.0507V3.85708H56.7478L57.0194 4.81316C57.7775 4.12863 58.677 3.73828 59.6104 3.73828H60.3515C62.2184 3.73828 63.2933 5.23745 63.2933 6.9912V14.6058H60.8607H60.855Z" fill="#121212" />
      <path d="M69.9292 6.01892H68.1755V11.1048C68.1755 11.9986 68.9336 12.604 69.8896 12.604V14.7254C67.2986 14.7254 65.7429 13.577 65.7429 11.1048V6.01892H64.4983V3.85785H65.7825L66.501 0.972656H68.1755V3.85785H69.9292V6.01892Z" fill="#121212" />
      <path d="M73.6517 8.26017H77.1762V7.2645C77.1762 6.38762 76.5539 5.9011 75.8128 5.9011H75.0151C74.274 5.9011 73.6517 6.38762 73.6517 7.2645V8.26017ZM73.6517 10.1667V11.2019C73.6517 12.0788 74.274 12.5653 75.0151 12.5653H75.8128C76.5539 12.5653 77.1762 12.0788 77.1762 11.2189V11.1793H79.6088V11.5131C79.6088 13.2046 78.3246 14.7264 76.1805 14.7264H74.8001C72.5599 14.7264 71.2134 13.1876 71.2134 11.4905V7.02689C71.2134 5.29577 72.5599 3.73438 74.8001 3.73438H76.1805C78.3246 3.73438 79.6088 5.29577 79.6088 7.02689V10.161H73.6461L73.6517 10.1667Z" fill="#121212" />
      <path d="M87.3819 14.6058V7.20617C87.3819 6.3293 86.7765 5.89935 86.075 5.89935H85.6281C85.0228 5.89935 84.4005 6.19353 84.0101 6.65742V14.6058H81.5775V3.85708H83.2747L83.5462 4.81316C84.3043 4.12863 85.2038 3.73828 86.1373 3.73828H86.8784C87.908 3.73828 88.7113 4.20783 89.1978 4.90933C89.9785 4.19086 90.912 3.73828 91.9077 3.73828H92.6487C94.5383 3.73828 95.5905 5.23745 95.5905 6.9912V14.6058H93.1579V7.20617C93.1579 6.3293 92.5752 5.89935 91.8511 5.89935H91.4042C90.7988 5.89935 90.1992 6.1709 89.8088 6.64045C89.8088 6.75925 89.8314 6.8724 89.8314 6.9912V14.6058H87.3988H87.3819Z" fill="#121212" />
      <path d="M100.094 6.64045V11.7829C100.524 12.2694 101.146 12.5636 101.768 12.5636H102.311C103.013 12.5636 103.618 12.0544 103.618 11.1606V7.28537C103.618 6.4085 102.996 5.90501 102.294 5.90501H101.729C101.106 5.90501 100.501 6.17655 100.094 6.64611M99.3582 3.85708L99.6297 4.77356C100.348 4.12863 101.185 3.73828 102.102 3.73828H103.132C104.981 3.73828 106.051 5.33362 106.051 7.1496V11.2964C106.051 13.1067 104.981 14.7247 103.132 14.7247H102.023C101.321 14.7247 100.676 14.4927 100.094 14.0797V18.6395H97.661V3.85708H99.3525H99.3582Z" fill="#121212" />
      <path d="M112.46 12.5636C113.202 12.5636 113.824 12.0771 113.824 11.2002V7.2684C113.824 6.39153 113.202 5.90501 112.46 5.90501H111.663C110.922 5.90501 110.299 6.39153 110.299 7.2684V11.2002C110.299 12.0771 110.922 12.5636 111.663 12.5636H112.46ZM111.448 14.7247C109.208 14.7247 107.861 13.1859 107.861 11.4944V7.0308C107.861 5.29968 109.208 3.73828 111.448 3.73828H112.828C114.972 3.73828 116.256 5.29968 116.256 7.0308V11.4944C116.256 13.1859 114.972 14.7247 112.828 14.7247H111.448Z" fill="#121212" />
      <path d="M124.244 5.96239H122.824C122.027 5.96239 121.229 6.35274 120.743 6.99766V14.6123H118.31V3.85789H120.002L120.313 4.98934C121.133 4.23127 122.146 3.76172 123.175 3.76172H124.244V5.96239Z" fill="#121212" />
      <path d="M126.62 10.4723H128.951L127.769 6.68194L126.62 10.4723ZM128.934 3.84766L132.493 14.6077H130.241L129.579 12.475H126.021L125.376 14.6077H123.107L126.666 3.84766H128.934Z" fill="#121212" />
      <path d="M139.259 5.96239H137.839C137.041 5.96239 136.243 6.35274 135.757 6.99766V14.6123H133.324V3.85789H135.016L135.327 4.98934C136.147 4.23127 137.16 3.76172 138.19 3.76172H139.259V5.96239Z" fill="#121212" />
      <path d="M141.923 18.6418L143.326 14.5912L139.53 3.85938H142.025L144.554 11.0837L147.066 3.85938H149.561L144.379 18.6418H141.923Z" fill="#121212" />
      <path d="M3.38869 14.608V3.1973H0V0.957031H9.01765V3.1973H5.90051V14.608H3.38869Z" fill="#121212" />
    </svg>
  );
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
        <div className="space-y-4 px-4 pb-4">{children}</div>
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

function FieldLabel({ label, descriptor }: { label: string; descriptor?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <Label className="text-xs">{label}</Label>
      {descriptor && <span className="text-xs text-muted-foreground">{descriptor}</span>}
    </div>
  );
}

function ColorField({
  label,
  descriptor,
  value,
  onChange,
}: {
  label: string;
  descriptor?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = (v: string) => {
    const s = v.startsWith("#") ? v : `#${v}`;
    if (/^#[0-9a-fA-F]{6}$/.test(s)) onChange(s.toLowerCase());
  };
  return (
    <div className="space-y-1.5">
      <FieldLabel label={label} descriptor={descriptor} />
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background"
        />
        <input
          type="text"
          value={text}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => setText(value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-xs uppercase"
          placeholder="#000000"
        />
      </div>
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
  const lineCount = comp.template === "D" ? 0 : (comp.titles[0]?.text.split("\n").length ?? 1);

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
      files.map(async (file) => {
        const url = await fileToDataUrl(file);
        const { naturalWidth, naturalHeight } = await loadDimensions(url);
        return { id: crypto.randomUUID(), src: url, naturalWidth, naturalHeight };
      }),
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
    <aside className="flex w-[480px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-background p-5">
      <Wordmark />

      {!isFreeform && (
        <Section title="Format">
          <SegmentedControl
            options={FORMATS}
            value={comp.format}
            onChange={(f) => update({ format: f })}
            columns={4}
          />
        </Section>
      )}

      <Section title="Template">
        <SegmentedControl
          options={TEMPLATES}
          value={comp.template}
          columns={4}
          getLabel={(t) =>
            t === "freeform" ? "Free" : t === "A" ? "1" : t === "B" ? "2" : t === "D" ? "3" : t
          }
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
                  {comp.images[0]?.src ? (
                    <img
                      src={comp.images[0].src}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div
                      className="h-14 w-14 shrink-0 rounded-md border border-border"
                      style={{ background: PLACEHOLDER_COLOR }}
                    />
                  )}
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
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={comp.images.length >= 5}
                  onClick={() => splitFileRef.current?.click()}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add images ({comp.images.length}/5)
                </Button>
                {comp.template === "A" && (
                  <SegmentedControl
                    options={["half", "span"] as SplitStyle[]}
                    value={comp.splitStyle}
                    onChange={(s) => update({ splitStyle: s })}
                    columns={2}
                    getLabel={(s) => (s === "half" ? "Half" : "Span")}
                  />
                )}
                {(comp.template === "B" ||
                  (comp.template === "A" && comp.splitStyle === "half")) && (
                  <SegmentedControl
                    options={["image-first", "title-first"] as SplitOrder[]}
                    value={comp.splitOrder}
                    onChange={(o) => update({ splitOrder: o })}
                    columns={2}
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
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => multiFileRef.current?.click()}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add images
                </Button>
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

      <Section title="Titles">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Mode</Label>
            <RerollButton
              disabled={comp.titleMode === "mixed"}
              onClick={() =>
                update({ titleSeed: newSeed(), titleAmplitude: null, titlePhase: null })
              }
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

        {comp.template !== "D" && lineCount >= 2 && comp.titleShift && (
          <div className="space-y-1.5 pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Shift distance</Label>
              <span className="text-xs text-muted-foreground">
                {Math.round(comp.titleShiftAmount * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[comp.titleShiftAmount]}
              onValueChange={([v]) => update({ titleShiftAmount: v })}
            />
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
                  onCheckedChange={(v) => update({ titleSizeMode: v ? "fit" : "fixed" })}
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
              const hidden = comp.captionHidden[slot.key];
              return (
                <div key={slot.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel label={slot.label} descriptor={slot.descriptor} />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
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
                        <TooltipContent>{hidden ? "Show field" : "Hide field"}</TooltipContent>
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

      {!isFreeform && (
        <Section title="Colors">
          <PaletteControls comp={comp} update={update} />
          <div className="space-y-3 border-t border-border pt-4">
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
                label={slot.label}
                descriptor={slot.descriptor}
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
      <line
        x1={pad}
        y1={H / 2}
        x2={W - pad}
        y2={H / 2}
        stroke="currentColor"
        strokeOpacity={0.15}
      />
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
