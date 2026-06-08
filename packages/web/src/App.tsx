import { useState } from "react";
import { FeedPage } from "@/pages/FeedPage.js";
import { SectorPage } from "@/pages/SectorPage.js";
import { DetailPage } from "@/pages/DetailPage.js";
import { cn } from "@/lib/utils.js";

type Page = "feed" | "sector" | "detail";

const NAV: { id: "feed" | "sector"; label: string }[] = [
  { id: "feed", label: "Incident Feed" },
  { id: "sector", label: "Sector View" },
];

export function App() {
  const [page, setPage] = useState<Page>("feed");
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);

  function handleSelectIncident(id: number) {
    setSelectedIncidentId(id);
    setPage("detail");
  }

  function handleBack() {
    setPage("feed");
    setSelectedIncidentId(null);
  }

  return (
    <div>
      {page !== "detail" && (
        <nav className="bg-gray-900 text-white">
          <div className="max-w-5xl mx-auto px-6 flex items-center gap-6 h-14">
            <span className="font-bold text-base tracking-tight text-white shrink-0">
              Threat Intel
            </span>
            <div className="flex gap-2">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setPage(n.id)}
                  className={cn(
                    "px-4 py-1.5 text-sm rounded-full transition-colors",
                    page === n.id
                      ? "bg-white text-gray-900 font-semibold"
                      : "text-gray-300 hover:text-white hover:bg-white/10",
                  )}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}
      {page === "feed" && <FeedPage onSelectIncident={handleSelectIncident} />}
      {page === "sector" && <SectorPage />}
      {page === "detail" && selectedIncidentId !== null && (
        <DetailPage incidentId={selectedIncidentId} onBack={handleBack} />
      )}
    </div>
  );
}
