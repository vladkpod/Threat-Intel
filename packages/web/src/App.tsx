import { useState } from "react";
import { ReconstructPage } from "@/pages/ReconstructPage.js";
import { SectorPage } from "@/pages/SectorPage.js";
import { cn } from "@/lib/utils.js";

type Page = "reconstruct" | "sector";

const NAV: { id: Page; label: string }[] = [
  { id: "reconstruct", label: "Product A — Incident Reconstruction" },
  { id: "sector", label: "Product B — Sector View" },
];

export function App() {
  const [page, setPage] = useState<Page>("reconstruct");

  return (
    <div>
      <nav className="border-b bg-muted/40">
        <div className="max-w-5xl mx-auto px-6 flex gap-1 py-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={cn(
                "px-3 py-2 text-sm rounded-sm transition-colors",
                page === n.id
                  ? "bg-background font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60",
              )}
            >
              {n.label}
            </button>
          ))}
        </div>
      </nav>
      {page === "reconstruct" ? <ReconstructPage /> : <SectorPage />}
    </div>
  );
}
