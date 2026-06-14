import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ControlPanel } from "@/components/ControlPanel";
import { Canvas } from "@/components/Canvas";
import { defaultComposition, type Composition } from "@/lib/composition";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Typographic Composer" },
      { name: "description", content: "A minimal tool for building typographic compositions." },
      { property: "og:title", content: "Typographic Composer" },
      { property: "og:description", content: "A minimal tool for building typographic compositions." },
    ],
  }),
  component: Index,
});

function Index() {
  const [comp, setComp] = useState<Composition>(defaultComposition);
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ControlPanel comp={comp} setComp={setComp} />
      <main className="flex-1">
        <Canvas comp={comp} />
      </main>
    </div>
  );
}
