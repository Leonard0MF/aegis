"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { ScanResult, Technology } from "@/types/scan";
import Panel from "@/components/ui/Panel";
import { Skeleton } from "@/components/ScanDetails";
import { KevBadge, SeverityBadge } from "./Severity";

const CATEGORY: Record<Technology["category"], string> = {
  server: "Servidor",
  language: "Linguagem",
  framework: "Framework",
  cms: "CMS",
  library: "Biblioteca JS",
  cdn: "CDN",
  hosting: "Hospedagem",
};

const COLLAPSED = 6;

export default function VulnsPanel({ data, isLoading }: { data?: ScanResult; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const vulns = data?.vulns ?? [];
  const totals = data?.vulnTotals;
  const tech = data?.tech ?? [];
  const shown = expanded ? vulns : vulns.slice(0, COLLAPSED);
  const fromBanner = tech.some((t) => t.version && (t.category === "server" || t.category === "language" || t.category === "cms"));

  return (
    <Panel
      title="Vulnerabilidades conhecidas"
      subtitle="Tecnologias detectadas cruzadas com OSV, NVD e CISA KEV"
      actions={
        totals && totals.total > 0 ? (
          <span className="flex items-center gap-1.5 text-xs tabular-nums">
            {totals.kev > 0 && <span className="text-bad font-medium">{totals.kev} explorada{totals.kev > 1 ? "s" : ""}</span>}
            <span className="text-dim">{totals.total} CVEs</span>
          </span>
        ) : undefined
      }
    >
      {isLoading ? (
        <Skeleton rows={5} />
      ) : !data ? (
        <p className="text-sm text-dim py-4">Sem dados.</p>
      ) : !data.tech ? (
        <p className="text-sm text-dim py-4">Scan antigo: escaneie de novo para ver tecnologias e CVEs.</p>
      ) : (
        <div className="space-y-4">
          {/* tecnologias */}
          <div>
            <p className="text-xs text-dim mb-2">Tecnologias identificadas</p>
            {tech.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma identificada (o servidor não expõe versões, o que é bom).</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tech.map((t) => (
                  <span
                    key={t.name}
                    title={t.evidence}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-panel-2 px-2 py-1 text-xs ring-1 ring-inset ring-line"
                  >
                    <span className="text-fg">{t.name}</span>
                    {t.version && <span className="font-mono text-warn">{t.version}</span>}
                    <span className="text-dim">{CATEGORY[t.category]}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* CVEs */}
          {totals && totals.total > 0 ? (
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2 tabular-nums">
                {totals.critical > 0 && <span className="text-bad">{totals.critical} críticas</span>}
                {totals.high > 0 && <span className="text-bad/80">{totals.high} altas</span>}
                {totals.medium > 0 && <span className="text-warn">{totals.medium} médias</span>}
                {totals.low > 0 && <span className="text-info">{totals.low} baixas</span>}
                {totals.total > vulns.length && <span className="text-dim">· mostrando as {vulns.length} mais graves</span>}
              </div>
              <ul className="divide-y divide-line/60 rounded-xl ring-1 ring-inset ring-line overflow-hidden">
                {shown.map((v) => (
                  <li key={`${v.affects}-${v.id}`} className="px-3 py-2.5 bg-panel-2/40">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-fg hover:text-accent inline-flex items-center gap-1"
                      >
                        {v.id}
                        <ExternalLink size={11} className="text-dim" />
                      </a>
                      <SeverityBadge severity={v.severity} score={v.cvss} />
                      {v.kev && <KevBadge />}
                      <span className="text-xs text-dim">{v.affects}</span>
                      {v.fixedIn && <span className="text-xs text-ok">corrigido em {v.fixedIn}</span>}
                    </div>
                    {v.summary && <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">{v.summary}</p>}
                  </li>
                ))}
              </ul>
              {vulns.length > COLLAPSED && (
                <button
                  type="button"
                  onClick={() => setExpanded((x) => !x)}
                  className="mt-2 text-xs text-accent hover:underline"
                >
                  {expanded ? "Mostrar menos" : `Mostrar todas (${vulns.length})`}
                </button>
              )}
              {fromBanner && (
                <p className="mt-3 text-[11px] text-dim leading-relaxed">
                  Versões lidas do banner do servidor. Distribuições Linux corrigem falhas sem mudar o número da versão
                  (backport), então confirme no servidor antes de tratar como vulnerável. A correção definitiva é
                  atualizar e esconder a versão do header.
                </p>
              )}
            </div>
          ) : (
            tech.some((t) => t.version) && (
              <p className="text-sm text-ok">Nenhuma CVE conhecida para as versões detectadas.</p>
            )
          )}
        </div>
      )}
    </Panel>
  );
}
