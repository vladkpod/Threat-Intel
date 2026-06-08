import { trpc } from "@/lib/trpc.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Badge } from "@/components/ui/badge.js";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.js";
import { techniqueDisplayName } from "@/lib/technique-names.js";
import type { SectorSummary } from "../../../sector/src/schema.js";

function TechniqueChips({ techniques }: { techniques: { technique_id: string; count: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {techniques.map((t) => (
        <span
          key={t.technique_id}
          className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
        >
          {techniqueDisplayName(t.technique_id)}
          <span className="text-slate-400">×{t.count}</span>
        </span>
      ))}
    </div>
  );
}

function SectorCard({ summary }: { summary: SectorSummary }) {
  const topKev = summary.recent_kevs[0] ?? null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base capitalize">{summary.sector.replace(/-/g, " ")}</CardTitle>
          <div className="flex gap-2 shrink-0">
            <Badge variant="secondary">{summary.threat_group_count} groups</Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {summary.kev_count} KEVs
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Top Techniques
          </p>
          <TechniqueChips techniques={summary.top_techniques} />
        </div>

        {topKev && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <span className="font-mono text-xs font-semibold text-amber-700 mr-2">
              {topKev.cveID}
            </span>
            <span className="text-amber-900">{topKev.vulnerabilityName}</span>
            {topKev.knownRansomwareCampaignUse === "Known" && (
              <Badge variant="destructive" className="ml-2 text-[10px] py-0">
                Ransomware
              </Badge>
            )}
          </div>
        )}

        <Accordion type="single" collapsible>
          <AccordionItem value="groups">
            <AccordionTrigger className="text-sm py-2">
              Threat Groups ({summary.threat_groups.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {summary.threat_groups.map((g) => (
                  <div key={g.id} className="rounded border p-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{g.id}</span>
                      <span className="font-semibold text-sm">{g.name}</span>
                      {g.aliases.slice(0, 3).map((a) => (
                        <Badge key={a} variant="outline" className="text-[10px] py-0">
                          {a}
                        </Badge>
                      ))}
                    </div>
                    {g.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {g.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {summary.recent_kevs.length > 0 && (
            <AccordionItem value="kevs">
              <AccordionTrigger className="text-sm py-2">
                Recent KEVs ({summary.kev_count} total)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {summary.recent_kevs.map((kev) => (
                    <div key={kev.cveID} className="rounded border p-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          {kev.cveID}
                        </span>
                        <span className="text-xs text-muted-foreground">{kev.dateAdded}</span>
                      </div>
                      <p className="text-sm">{kev.vulnerabilityName}</p>
                      <p className="text-xs text-muted-foreground">
                        {kev.vendorProject} — {kev.product}
                      </p>
                      {kev.knownRansomwareCampaignUse === "Known" && (
                        <Badge variant="destructive" className="mt-1 text-[10px] py-0">
                          Ransomware
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export function SectorPage() {
  const query = trpc.sector.view.useQuery();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">
          Threat Intelligence — Sector View
        </h1>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {query.isFetching && (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="py-8">
                  <div className="h-4 bg-muted rounded animate-pulse mb-3 w-1/2" />
                  <div className="h-3 bg-muted rounded animate-pulse mb-2 w-full" />
                  <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {query.data && (
          <>
            <p className="text-sm text-muted-foreground">
              ATT&CK {query.data.attack_version} · KEV {query.data.kev_version} ·{" "}
              {query.data.sectors.length} sectors · generated{" "}
              {new Date(query.data.generated_at).toLocaleString()}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {query.data.sectors.map((sector) => (
                <SectorCard key={sector.sector} summary={sector} />
              ))}
            </div>
          </>
        )}

        {query.error && (
          <p className="text-sm text-destructive">Error: {query.error.message}</p>
        )}
      </main>
    </div>
  );
}
