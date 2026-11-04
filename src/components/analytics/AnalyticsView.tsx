"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BarChart3, CheckCircle2, CircleAlert, CircleDot, ExternalLink, RefreshCw, Table2 } from "lucide-react";
import type { ScanResult } from "@/types/scan";
import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/components/SecurityStatus";
import ScoreChart, { BIG_DELTA, ScoreTable } from "@/components/analytics/ScoreChart";
import {
  type CheckChange,
  byDomain,
  categoryCounts,
  certDeadlines,
  commonIssues,
  diffScans,
  kevHits,
  latestPerDomain,
  scoreSeries,
  staleDomains,
} from "@/lib/analytics";
import { useNowMinute, useScanHistory } from "@/lib/storage/useScanHistory";

const SELECT =
  "rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-xs text-fg outline-none focus:border-accent/50 max-w-full";
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-dim py-8 text-center">{children}</p>;
}

/* ---------------- 1. evolução da nota ---------------- */

function ScoreEvolution({ history, domain }: { history: ScanResult[]; domain: string | null }) {
  const [asTable, setAsTable] = useState(false);
  const { series, hidden } = useMemo(() => scoreSeries(history, domain), [history, domain]);
  const points = series.reduce((n, s) => n + s.points.length, 0);
  const moves = series.flatMap((s) => s.points.filter((p) => p.delta !== null && Math.abs(p.delta) >= BIG_DELTA)).length;

  return (
    <Panel
      title="Evolução da nota"
      subtitle={
        domain
          ? `${points} ${points === 1 ? "scan" : "scans"} de ${domain}`
          : `${series.length} ${series.length === 1 ? "domínio" : "domínios"}${hidden ? ` (os ${series.length} mais recentes; ${hidden} oculto${hidden > 1 ? "s" : ""})` : ""}`
      }
      actions={
        points > 0 && (
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[11px] text-muted hover:text-fg"
          >
            {asTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
            {asTable ? "Gráfico" : "Tabela"}
          </button>
        )
      }
    >
      {points === 0 ? (
        <Empty>Nenhum scan no histórico.</Empty>
      ) : (
        <>
          {asTable ? <ScoreTable series={series} /> : <ScoreChart series={series} />}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-dim">
            {series.length > 1 &&
              series.map((s) => (
                <span key={s.domain} className="inline-flex items-center gap-1.5 text-muted">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                  {s.domain}
                </span>
              ))}
            <span>Faixas: ≥80 excelente · 50–79 moderada · &lt;50 fraca</span>
            {moves > 0 && <span>▲▼ variação de {BIG_DELTA}+ pontos</span>}
          </div>
          {points < 2 && <p className="mt-2 text-xs text-dim">Escaneie de novo para ver a evolução.</p>}
        </>
      )}
    </Panel>
  );
}

/* ---------------- 2. o que mudou ---------------- */

function ChangeList({ title, items, tone, icon: Icon, empty }: {
  title: string;
  items: CheckChange[];
  tone: string;
  icon: typeof CheckCircle2;
  empty: string;
}) {
  return (
    <div className="min-w-0">
      <p className={`flex items-center gap-1.5 text-xs font-medium ${tone}`}>
        <Icon size={14} />
        {title}
        <span className="text-dim tabular-nums">({items.length})</span>
      </p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-xs text-dim">{empty}</p>
      ) : (
        <ul className="mt-1.5 divide-y divide-line/60 rounded-xl border border-line/70 bg-canvas/40">
          {items.map((c) => {
            const shown = c.after ?? c.before!;
            return (
              <li key={c.id} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] text-fg">{c.label}</p>
                  <p className="text-[11px] text-dim">{CATEGORY_LABEL[c.category]}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {c.before && c.after && c.before.status !== c.after.status && (
                    <>
                      <StatusBadge status={c.before.status} />
                      <ArrowRight size={12} className="text-dim" />
                    </>
                  )}
                  <StatusBadge status={shown.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ScanChanges({ scans, domain }: { scans: ScanResult[]; domain: string }) {
  // índices em ordem cronológica; padrão: penúltimo → último
  const [from, setFrom] = useState(Math.max(0, scans.length - 2));
  const [to, setTo] = useState(scans.length - 1);
  const a = scans[Math.min(from, scans.length - 1)];
  const b = scans[Math.min(to, scans.length - 1)];
  const diff = useMemo(() => (a && b && a !== b ? diffScans(a, b) : null), [a, b]);

  const picker = (value: number, onChange: (v: number) => void, label: string) => (
    <label className="flex items-center gap-1.5 text-xs text-dim">
      {label}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={SELECT}>
        {scans.map((s, i) => (
          <option key={s.scannedAt} value={i}>
            {fmtDate(s.scannedAt)} · {s.score}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Panel title="O que mudou entre scans" subtitle={domain}>
      {scans.length < 2 ? (
        <Empty>Só existe um scan de {domain}. Escaneie de novo para comparar.</Empty>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {picker(from, setFrom, "De")}
            {picker(to, setTo, "Para")}
          </div>
          {!diff ? (
            <Empty>Escolha dois scans diferentes.</Empty>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Delta label="Nota" value={diff.scoreDelta} />
                <Delta label="Corrigidos" value={diff.fixed.length} plain tone="text-ok" />
                <Delta label="Novos problemas" value={diff.introduced.length} plain tone={diff.introduced.length ? "text-bad" : "text-fg"} />
              </div>
              {from > to && <p className="text-xs text-warn">“De” é mais recente que “Para”: a comparação está invertida.</p>}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChangeList title="Novos problemas" items={diff.introduced} tone="text-bad" icon={CircleAlert} empty="Nenhum problema novo." />
                <ChangeList title="Corrigidos" items={diff.fixed} tone="text-ok" icon={CheckCircle2} empty="Nada foi corrigido entre esses scans." />
              </div>
              <ChangeList
                title="Continuam abertos"
                items={diff.stillOpen}
                tone="text-warn"
                icon={CircleDot}
                empty="Nenhum problema pendente."
              />
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

function Delta({ label, value, plain, tone }: { label: string; value: number; plain?: boolean; tone?: string }) {
  const color = tone ?? (value > 0 ? "text-ok" : value < 0 ? "text-bad" : "text-fg");
  return (
    <div className="rounded-xl border border-line/70 bg-canvas/40 px-2 py-2.5">
      <p className={`font-mono text-xl tabular-nums ${color}`}>{plain ? value : signed(value)}</p>
      <p className="text-[11px] text-dim">{label}</p>
    </div>
  );
}

/* ---------------- 3. falhas mais comuns ---------------- */

function CommonIssues({ scans, domain }: { scans: ScanResult[]; domain: string | null }) {
  const issues = useMemo(() => commonIssues(scans).slice(0, 8), [scans]);
  const cats = useMemo(() => categoryCounts(domain ? scans.slice(-1) : scans, CATEGORY_ORDER), [scans, domain]);
  const total = scans.length;
  const unit = domain ? "scans" : "domínios";

  return (
    <Panel
      title={domain ? "Problemas mais persistentes" : "Falhas mais comuns"}
      subtitle={domain ? `Em quantos dos ${total} scans de ${domain} cada problema apareceu` : `Último scan de cada um dos ${total} domínios`}
    >
      {issues.length === 0 ? (
        <Empty>Nenhum problema aberto.</Empty>
      ) : (
        <ul className="space-y-2.5">
          {issues.map((it) => {
            const pct = (it.hits / total) * 100;
            const bad = it.fails >= it.warns;
            return (
              <li key={it.key} title={domain ? undefined : it.domains.join(", ")}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-fg">
                    {it.label} <span className="text-dim">· {CATEGORY_LABEL[it.category]}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {it.hits}/{total} {unit}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-panel-2">
                  <div
                    className={`h-full rounded-full ${bad ? "bg-bad" : "bg-warn"}`}
                    style={{ width: `${Math.max(pct, 3)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cats.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-dim mb-2">
            Por categoria{domain ? " (último scan)" : ""}
          </p>
          <ul className="space-y-1.5">
            {cats.map((c) => {
              const n = c.fail + c.warn + c.pass;
              const seg = [
                { k: "fail", v: c.fail, cls: "bg-bad", label: "falhas" },
                { k: "warn", v: c.warn, cls: "bg-warn", label: "atenção" },
                { k: "pass", v: c.pass, cls: "bg-ok/70", label: "ok" },
              ].filter((s) => s.v > 0);
              return (
                <li
                  key={c.category}
                  className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-2 text-xs"
                  title={`${CATEGORY_LABEL[c.category]}: ${c.fail} falhas · ${c.warn} atenção · ${c.pass} ok`}
                >
                  <span className="truncate text-muted">{CATEGORY_LABEL[c.category]}</span>
                  <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                    {seg.map((s) => (
                      <div key={s.k} className={s.cls} style={{ width: `${(s.v / n) * 100}%` }} />
                    ))}
                  </div>
                  <span className="text-right tabular-nums text-dim">
                    {c.fail + c.warn > 0 ? `${c.fail + c.warn} ab.` : "ok"}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex gap-3 text-[11px] text-dim">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-bad" />falha</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warn" />atenção</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-ok/70" />ok</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- 4. prazos e riscos ---------------- */

function Deadlines({ latest, nowMinute }: { latest: ScanResult[]; nowMinute: number }) {
  const now = nowMinute * 60_000;
  const certs = useMemo(() => (now ? certDeadlines(latest, now) : []), [latest, now]);
  const noTls = latest.filter((r) => !r.tls).map((r) => r.domain);
  const kev = useMemo(() => kevHits(latest), [latest]);
  const stale = useMemo(() => (now ? staleDomains(latest, now) : []), [latest, now]);

  return (
    <Panel title="Prazos e riscos" subtitle="Certificados, CVEs exploradas e dados antigos">
      <div className="space-y-5">
        <section>
          <p className="text-[11px] font-medium uppercase tracking-wider text-dim mb-2">Certificados (próximos 90 dias)</p>
          {certs.length === 0 && noTls.length === 0 ? (
            <p className="text-xs text-dim">Nenhum certificado vence nos próximos 90 dias.</p>
          ) : (
            <ul className="space-y-2">
              {certs.map((c) => {
                const tone = c.daysLeft < 0 ? "bg-bad" : c.daysLeft < 30 ? "bg-warn" : "bg-info";
                return (
                  <li key={c.domain} className="text-xs" title={`${c.issuer} · vence em ${new Date(c.validTo).toLocaleDateString("pt-BR")}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-fg">{c.domain}</span>
                      <span className={`shrink-0 tabular-nums ${c.daysLeft < 0 ? "text-bad" : c.daysLeft < 30 ? "text-warn" : "text-muted"}`}>
                        {c.daysLeft < 0 ? `venceu há ${-c.daysLeft} d` : `${c.daysLeft} dias`}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-panel-2">
                      <div className={`h-full rounded-full ${tone}`} style={{ width: `${c.daysLeft < 0 ? 100 : Math.max(3, (1 - c.daysLeft / 90) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
              {noTls.map((d) => (
                <li key={d} className="flex justify-between gap-3 text-xs">
                  <span className="truncate text-fg">{d}</span>
                  <span className="text-bad">sem HTTPS</span>
                </li>
              ))}
            </ul>
          )}
          {certs.length > 0 && <p className="mt-1.5 text-[11px] text-dim">A barra enche conforme o vencimento se aproxima.</p>}
        </section>

        <section>
          <p className="text-[11px] font-medium uppercase tracking-wider text-dim mb-2">CVEs com exploração ativa (CISA KEV)</p>
          {kev.length === 0 ? (
            <p className="text-xs text-dim">Nenhuma CVE do catálogo KEV nas tecnologias detectadas.</p>
          ) : (
            <ul className="divide-y divide-line/60 rounded-xl border border-bad/30 bg-bad/5">
              {kev.slice(0, 8).map(({ domain, vuln }) => (
                <li key={`${domain}-${vuln.id}`} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <a href={vuln.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-fg hover:text-accent">
                      {vuln.id} <ExternalLink size={11} />
                    </a>
                    <p className="text-dim truncate">{domain} · {vuln.affects}{vuln.fixedIn ? ` · corrigido em ${vuln.fixedIn}` : ""}</p>
                  </div>
                  {vuln.cvss !== undefined && <span className="shrink-0 font-mono text-bad">{vuln.cvss.toFixed(1)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <p className="text-[11px] font-medium uppercase tracking-wider text-dim mb-2">Dados desatualizados (+7 dias)</p>
          {stale.length === 0 ? (
            <p className="text-xs text-dim">Todos os domínios foram escaneados na última semana.</p>
          ) : (
            <ul className="space-y-1.5">
              {stale.map((s) => (
                <li key={s.domain} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-fg">{s.domain} <span className="text-dim">· há {s.days} d</span></span>
                  <Link
                    href={`/?d=${encodeURIComponent(s.domain)}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] text-muted hover:text-fg"
                  >
                    <RefreshCw size={11} /> Abrir
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Panel>
  );
}

/* ---------------- página ---------------- */

export default function AnalyticsView() {
  const history = useScanHistory();
  const nowMinute = useNowMinute();
  const [picked, setPicked] = useState<string>("");

  const groups = useMemo(() => byDomain(history), [history]);
  const domains = useMemo(() => [...groups.keys()].sort((a, b) => a.localeCompare(b)), [groups]);
  const domain = picked && groups.has(picked) ? picked : null;
  const latest = useMemo(() => latestPerDomain(history), [history]);
  const scope = domain ? groups.get(domain)! : latest;
  const scopeLatest = domain ? scope.slice(-1) : latest;
  // "O que mudou" precisa de um domínio: sem filtro, usa o escaneado mais recentemente
  const diffDomain = domain ?? history[0]?.domain ?? null;

  return (
    <main className="px-4 py-5 md:px-8 md:py-6 space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg">Análises</h1>
          <p className="text-sm text-muted mt-0.5">
            {history.length
              ? `${history.length} ${history.length === 1 ? "scan" : "scans"} de ${domains.length} ${domains.length === 1 ? "domínio" : "domínios"} ao longo do tempo`
              : "Tendências e comparações a partir do histórico de scans"}
          </p>
        </div>
        {domains.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-dim">
            Domínio
            <select value={domain ?? ""} onChange={(e) => setPicked(e.target.value)} className={`${SELECT} sm:w-64`}>
              <option value="">Todos os domínios</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-panel/60 px-6 py-16 text-center">
          <BarChart3 size={28} className="mx-auto text-dim" strokeWidth={1.5} />
          <p className="text-sm text-fg mt-3">Sem dados para analisar</p>
          <p className="text-xs text-dim mt-1">
            Faça scans na <Link href="/" className="text-accent hover:underline">Visão geral</Link> ou em{" "}
            <Link href="/assets" className="text-accent hover:underline">Ativos</Link>. As análises usam o histórico salvo neste navegador.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          <div className="xl:col-span-2 space-y-4 min-w-0">
            <ScoreEvolution history={history} domain={domain} />
            {diffDomain && <ScanChanges key={`${diffDomain}-${groups.get(diffDomain)!.length}`} scans={groups.get(diffDomain)!} domain={diffDomain} />}
          </div>
          <div className="space-y-4 min-w-0">
            <Deadlines latest={scopeLatest} nowMinute={nowMinute} />
            <CommonIssues scans={scope} domain={domain} />
          </div>
        </div>
      )}
    </main>
  );
}
