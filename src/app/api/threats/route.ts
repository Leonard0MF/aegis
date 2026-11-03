import { getKev } from "@/lib/scanner/kev";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Feed do CISA KEV: entradas mais recentes + estatísticas. `?ids=CVE-1,CVE-2` devolve essas também. */
export async function GET(req: Request) {
  const kev = await getKev();
  if (!kev) return Response.json({ error: "Catálogo CISA KEV indisponível" }, { status: 502 });

  const url = new URL(req.url);
  const wanted = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^CVE-\d{4}-\d+$/.test(s))
    .slice(0, 100);

  const sorted = [...kev.entries].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
  const now = Date.now();
  const since = (days: number) => sorted.filter((e) => now - new Date(e.dateAdded).getTime() <= days * DAY_MS).length;

  const vendors = new Map<string, number>();
  for (const e of sorted.slice(0, 300)) vendors.set(e.vendorProject, (vendors.get(e.vendorProject) ?? 0) + 1);

  return Response.json(
    {
      catalogVersion: kev.version,
      updated: kev.updated,
      total: sorted.length,
      last7: since(7),
      last30: since(30),
      ransomware: sorted.filter((e) => e.knownRansomwareCampaignUse === "Known").length,
      topVendors: [...vendors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
      recent: sorted.slice(0, 60),
      matches: wanted.map((id) => kev.byId.get(id)).filter(Boolean),
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
