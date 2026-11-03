/** Catálogo CISA KEV: vulnerabilidades com exploração ativa confirmada. */

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const TTL_MS = 12 * 60 * 60 * 1000;

export interface KevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
}

export interface KevCatalog {
  version: string;
  updated: string;
  entries: KevEntry[];
  byId: Map<string, KevEntry>;
}

let cache: { at: number; data: KevCatalog } | null = null;
let inflight: Promise<KevCatalog | null> | null = null;

export async function getKev(): Promise<KevCatalog | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const r = await fetch(KEV_URL, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return cache?.data ?? null;
      const j = (await r.json()) as { catalogVersion: string; dateReleased: string; vulnerabilities: KevEntry[] };
      const data: KevCatalog = {
        version: j.catalogVersion,
        updated: j.dateReleased,
        entries: j.vulnerabilities,
        byId: new Map(j.vulnerabilities.map((v) => [v.cveID, v])),
      };
      cache = { at: Date.now(), data };
      return data;
    } catch {
      return cache?.data ?? null; // sem rede: usa a versão antiga, se houver
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
