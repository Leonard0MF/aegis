"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import Panel from "@/components/ui/Panel";
import { KevBadge, SeverityBadge } from "@/components/deep/Severity";
import { buildAssets } from "@/lib/assets";
import { useScanHistory } from "@/lib/storage/useScanHistory";
import { getThreats, type KevItem, type ThreatFeed } from "@/lib/services/scanner";
import type { Vulnerability } from "@/types/scan";

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");

function Stat({ label, value, hint, tone = "text-fg" }: { label: string; value: string | number; hint: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/90 p-4 sm:p-5">
      <p className="text-xs text-dim">{label}</p>
      <p className={`mt-1 font-mono text-2xl sm:text-3xl tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] text-dim truncate">{hint}</p>
    </div>
  );
}

function KevRow({ k }: { k: KevItem }) {
  return (
    <li className="px-4 py-3 border-b border-line/60 last:border-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <a
          href={`https://nvd.nist.gov/vuln/detail/${k.cveID}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-fg hover:text-accent inline-flex items-center gap-1"
        >
          {k.cveID}
          <ExternalLink size={11} className="text-dim" />
        </a>
        <span className="text-xs text-muted">
          {k.vendorProject} · {k.product}
        </span>
        {k.knownRansomwareCampaignUse === "Known" && (
          <span className="rounded-md bg-bad/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-bad ring-1 ring-inset ring-bad/30">
            Ransomware
          </span>
        )}
        <span className="ml-auto text-[11px] text-dim tabular-nums">{fmt(k.dateAdded)}</span>
      </div>
      <p className="mt-1 text-sm text-fg/90">{k.vulnerabilityName}</p>
      <p className="mt-0.5 text-xs text-muted leading-relaxed line-clamp-2">{k.shortDescription}</p>
    </li>
  );
}

export default function ThreatsView() {
  const history = useScanHistory();
  const assets = useMemo(() => buildAssets(history), [history]);
  const [feed, setFeed] = useState<ThreatFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  /** CVEs encontradas no último scan de cada ativo */
  const exposures = useMemo(() => {
    const out: { domain: string; v: Vulnerability }[] = [];
    for (const a of assets) for (const v of a.latest.vulns ?? []) out.push({ domain: a.domain, v });
    return out;
  }, [assets]);
  const kevIds = useMemo(
    () => [...new Set(exposures.filter((e) => e.v.kev).map((e) => e.v.id))].sort().join(","),
    [exposures],
  );

  useEffect(() => {
    let alive = true;
    getThreats(kevIds ? kevIds.split(",") : [])
      .then((f) => alive && setFeed(f))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Falha ao carregar"));
    return () => {
      alive = false;
    };
  }, [kevIds]);

  const kevById = useMemo(() => new Map((feed?.matches ?? []).map((k) => [k.cveID, k])), [feed]);
  const exploited = exposures.filter((e) => e.v.kev);
  const affectedDomains = new Set(exposures.map((e) => e.domain)).size;
  // a lista guarda só as mais graves por tecnologia; o total real vem de vulnTotals
  const totalCves = assets.reduce((n, a) => n + (a.latest.vulnTotals?.total ?? a.latest.vulns?.length ?? 0), 0);

  const recent = (feed?.recent ?? []).filter((k) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [k.cveID, k.vendorProject, k.product, k.vulnerabilityName].some((f) => f.toLowerCase().includes(s));
  });

  return (
    <main className="px-4 py-5 md:px-8 md:py-6 space-y-4">
      <header className="mb-2">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Ameaças</h1>
        <p className="text-sm text-muted mt-0.5">
          Vulnerabilidades com exploração ativa confirmada (CISA KEV), cruzadas com os seus ativos
          {feed && <span className="text-dim"> · catálogo {feed.catalogVersion}</span>}
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat
          label="Exploradas nos seus ativos"
          value={exploited.length}
          hint={exploited.length ? "corrija primeiro" : assets.length ? "nenhuma encontrada" : "escaneie um domínio"}
          tone={exploited.length ? "text-bad" : "text-ok"}
        />
        <Stat label="CVEs nos seus ativos" value={totalCves} hint={`em ${affectedDomains} de ${assets.length} domínios`} tone={totalCves ? "text-warn" : "text-fg"} />
        <Stat label="Novas no catálogo" value={feed ? feed.last30 : "…"} hint={feed ? `${feed.last7} nos últimos 7 dias` : "carregando"} />
        <Stat label="Usadas por ransomware" value={feed ? feed.ransomware : "…"} hint={feed ? `de ${feed.total} no catálogo` : "carregando"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Panel
          title="Nos seus ativos"
          subtitle="CVEs do último scan de cada domínio"
          className="xl:col-span-2 min-w-0"
          bodyClassName="px-0 sm:px-0 pb-0 sm:pb-0"
        >
          {assets.length === 0 ? (
            <p className="px-4 sm:px-5 pb-5 text-sm text-dim">
              Nenhum ativo ainda. <Link href="/assets" className="text-accent hover:underline">Adicione domínios</Link> para
              cruzar com o catálogo.
            </p>
          ) : exposures.length === 0 ? (
            <p className="px-4 sm:px-5 pb-5 text-sm text-ok">
              Nenhuma CVE conhecida nas versões detectadas dos seus {assets.length} domínios.
            </p>
          ) : (
            <ul className="max-h-[36rem] overflow-y-auto">
              {[...exposures]
                .sort((a, b) => Number(b.v.kev) - Number(a.v.kev) || (b.v.cvss ?? 0) - (a.v.cvss ?? 0))
                .slice(0, 80)
                .map(({ domain, v }) => {
                  const k = kevById.get(v.id);
                  return (
                    <li key={`${domain}-${v.affects}-${v.id}`} className="px-4 sm:px-5 py-3 border-b border-line/60 last:border-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <a href={v.url} target="_blank" rel="noreferrer" className="font-mono text-xs text-fg hover:text-accent">
                          {v.id}
                        </a>
                        <SeverityBadge severity={v.severity} score={v.cvss} />
                        {v.kev && <KevBadge />}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        <Link href={`/?d=${encodeURIComponent(domain)}`} className="text-fg hover:text-accent">
                          {domain}
                        </Link>{" "}
                        · {v.affects}
                        {v.fixedIn && <span className="text-ok"> · corrigido em {v.fixedIn}</span>}
                      </p>
                      {k && (
                        <p className="mt-1 text-[11px] text-bad/90 leading-relaxed">
                          {k.requiredAction} <span className="text-dim">(prazo CISA: {fmt(k.dueDate)})</span>
                        </p>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Exploradas recentemente"
          subtitle="Últimas entradas do catálogo CISA KEV"
          className="xl:col-span-3 min-w-0"
          bodyClassName="px-0 sm:px-0 pb-0 sm:pb-0"
          actions={
            <label className="relative block">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-dim" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Fornecedor, produto, CVE"
                aria-label="Filtrar ameaças"
                className="w-40 sm:w-56 rounded-lg border border-line bg-panel-2/60 pl-7 pr-2 py-1 text-xs text-fg placeholder:text-dim outline-none focus:border-accent/50"
              />
            </label>
          }
        >
          {error ? (
            <p className="px-4 sm:px-5 pb-5 text-sm text-bad">Erro: {error}</p>
          ) : !feed ? (
            <div className="px-4 sm:px-5 pb-5 space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-panel-2 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="px-4 sm:px-5 pb-3 flex flex-wrap gap-1.5">
                {feed.topVendors.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => setQ(q === v.name ? "" : v.name)}
                    className={`rounded-md px-2 py-0.5 text-[11px] ring-1 ring-inset ${
                      q === v.name ? "bg-accent/15 text-accent ring-accent/30" : "bg-panel-2 text-muted ring-line hover:text-fg"
                    }`}
                  >
                    {v.name} <span className="text-dim tabular-nums">{v.count}</span>
                  </button>
                ))}
              </div>
              <ul className="max-h-[36rem] overflow-y-auto border-t border-line/60">
                {recent.length ? recent.map((k) => <KevRow key={k.cveID} k={k} />) : (
                  <li className="px-5 py-4 text-sm text-dim">Nada encontrado.</li>
                )}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </main>
  );
}
