"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Boxes, ExternalLink, FileText, Gauge, RefreshCw, Search, ShieldAlert, Trash2 } from "lucide-react";
import DomainScanner from "@/components/DomainScanner";
import Panel from "@/components/ui/Panel";
import Sparkline from "@/components/assets/Sparkline";
import { type Asset, type SortKey, buildAssets, scoreTier, sortAssets, timeAgo } from "@/lib/assets";
import { scanDomain } from "@/lib/services/scanner";
import { removeDomain, saveScan } from "@/lib/storage/scanHistory";
import { useNowMinute, useScanHistory } from "@/lib/storage/useScanHistory";

const SORT_LABEL: Record<SortKey, string> = {
  worst: "Piores primeiro",
  name: "Nome",
  recent: "Último scan",
  cert: "Validade do certificado",
};

const TIER_BADGE = {
  ok: "bg-ok/10 text-ok ring-ok/25",
  warn: "bg-warn/10 text-warn ring-warn/25",
  bad: "bg-bad/10 text-bad ring-bad/25",
};

function certInfo(a: Asset): { text: string; tone: string } {
  const tls = a.latest.tls;
  if (!tls) return { text: "Sem HTTPS", tone: "text-bad" };
  if (!tls.valid && tls.daysRemaining >= 0) return { text: "Inválido", tone: "text-bad" };
  if (tls.daysRemaining < 0) return { text: "Expirado", tone: "text-bad" };
  return { text: `${tls.daysRemaining} dias`, tone: tls.daysRemaining < 30 ? "text-warn" : "text-muted" };
}

function needsCertAttention(a: Asset) {
  const tls = a.latest.tls;
  return !tls || !tls.valid || tls.daysRemaining < 30;
}

/* ---------------- resumo ---------------- */

function SummaryCard({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/90 p-4 sm:p-5 flex gap-4 items-start min-w-0">
      <span className="hidden sm:inline-flex rounded-xl p-2.5 bg-info/10 text-info">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className={`mt-1 font-mono text-2xl sm:text-3xl font-medium tabular-nums ${tone}`}>{value}</p>
        <p className="text-xs text-dim mt-1 truncate">{sub}</p>
      </div>
    </div>
  );
}

/* ---------------- linha ---------------- */

const GRID = "lg:grid-cols-[minmax(0,1.6fr)_8.5rem_6rem_6.5rem_6.5rem_minmax(0,1fr)_7.5rem]";

function AssetRow({
  asset,
  nowMinute,
  busy,
  error,
  disabled,
  onRescan,
  onRemove,
}: {
  asset: Asset;
  nowMinute: number;
  busy: boolean;
  error?: string;
  disabled: boolean;
  onRescan: () => void;
  onRemove: () => void;
}) {
  const { latest, previous } = asset;
  const t = scoreTier(latest.score);
  const delta = previous ? latest.score - previous.score : null;
  const cert = certInfo(asset);
  const server = latest.geo?.servers[0];
  const ago = timeAgo(latest.scannedAt, nowMinute);

  return (
    <li className={`px-4 py-3.5 transition-opacity ${busy ? "opacity-60" : ""}`}>
      <div className={`grid grid-cols-2 gap-x-4 gap-y-3 items-center ${GRID}`}>
        {/* domínio */}
        <div className="col-span-2 lg:col-span-1 min-w-0">
          <Link href={`/?d=${encodeURIComponent(asset.domain)}`} className="text-sm font-medium text-fg hover:text-accent transition-colors break-all">
            {asset.domain}
          </Link>
          <p className="text-xs text-dim mt-0.5">
            {asset.scanCount} {asset.scanCount === 1 ? "scan" : "scans"}
            {ago && ` · ${ago}`}
          </p>
        </div>

        {/* nota + variação */}
        <div className="flex items-center gap-2.5">
          <span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-semibold ring-1 ring-inset ${TIER_BADGE[t.tier]}`}>
            {latest.grade}
          </span>
          <div className="leading-tight">
            <p className="font-mono text-sm tabular-nums text-fg">{latest.score}</p>
            <p
              className={`font-mono text-[11px] tabular-nums ${
                delta == null ? "text-dim" : delta > 0 ? "text-ok" : delta < 0 ? "text-bad" : "text-dim"
              }`}
              title={previous ? `Scan anterior: ${previous.score}` : "Primeiro scan"}
            >
              {delta == null ? "novo" : delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "= 0"}
            </p>
          </div>
        </div>

        {/* tendência */}
        <div className="justify-self-end lg:justify-self-start">
          <Sparkline values={asset.scores} />
        </div>

        {/* certificado */}
        <div>
          <p className="text-[11px] text-dim lg:hidden">Certificado</p>
          <p className={`text-sm tabular-nums ${cert.tone}`}>{cert.text}</p>
        </div>

        {/* problemas */}
        <div>
          <p className="text-[11px] text-dim lg:hidden">Problemas</p>
          <p className="text-sm tabular-nums">
            <span className={asset.fails ? "text-bad" : "text-dim"}>{asset.fails} falhas</span>
            <span className="text-dim"> · </span>
            <span className={asset.warns ? "text-warn" : "text-dim"}>{asset.warns}</span>
          </p>
        </div>

        {/* local */}
        <div className="min-w-0">
          <p className="text-[11px] text-dim lg:hidden">Servidor</p>
          <p className="text-sm text-muted truncate" title={server ? `${server.city}, ${server.country} · ${server.org}` : undefined}>
            {server ? [server.city, server.countryCode].filter(Boolean).join(" · ") : "—"}
          </p>
        </div>

        {/* ações */}
        <div className="col-span-2 lg:col-span-1 flex items-center justify-end gap-1">
          <IconButton label={`Reescanear ${asset.domain}`} onClick={onRescan} disabled={disabled || busy}>
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          </IconButton>
          <Link
            href={`/?d=${encodeURIComponent(asset.domain)}`}
            aria-label={`Abrir ${asset.domain} no painel`}
            title="Abrir no painel"
            className="grid h-8 w-8 place-items-center rounded-lg text-dim hover:text-fg hover:bg-panel-2 transition-colors"
          >
            <ExternalLink size={15} />
          </Link>
          <Link
            href={`/report?d=${encodeURIComponent(asset.domain)}`}
            aria-label={`Relatório de ${asset.domain}`}
            title="Relatório (PDF)"
            className="grid h-8 w-8 place-items-center rounded-lg text-dim hover:text-fg hover:bg-panel-2 transition-colors"
          >
            <FileText size={15} />
          </Link>
          <IconButton label={`Remover ${asset.domain}`} onClick={onRemove} disabled={busy} danger>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-bad">Falha ao reescanear: {error}</p>}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-lg text-dim transition-colors hover:bg-panel-2 disabled:opacity-40 disabled:pointer-events-none ${
        danger ? "hover:text-bad" : "hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------------- página ---------------- */

export default function AssetsView() {
  const history = useScanHistory();
  const nowMinute = useNowMinute();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("worst");
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const cancelBulk = useRef(false);

  const assets = useMemo(() => buildAssets(history), [history]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortAssets(q ? assets.filter((a) => a.domain.includes(q)) : assets, sort);
  }, [assets, query, sort]);

  const summary = useMemo(() => {
    const n = assets.length;
    const avg = n ? Math.round(assets.reduce((s, a) => s + a.latest.score, 0) / n) : 0;
    return {
      n,
      avg,
      withFails: assets.filter((a) => a.fails > 0).length,
      certAlerts: assets.filter(needsCertAttention).length,
    };
  }, [assets]);

  const setBusyFor = (domain: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(domain);
      else next.delete(domain);
      return next;
    });

  async function rescan(domain: string) {
    setBusyFor(domain, true);
    setErrors((e) => {
      const next = { ...e };
      delete next[domain];
      return next;
    });
    try {
      saveScan(await scanDomain(domain));
    } catch (err) {
      setErrors((e) => ({ ...e, [domain]: err instanceof Error ? err.message : "erro desconhecido" }));
    } finally {
      setBusyFor(domain, false);
    }
  }

  async function rescanAll() {
    const targets = visible.map((a) => a.domain);
    cancelBulk.current = false;
    setBulk({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      if (cancelBulk.current) break;
      await rescan(targets[i]); // um por vez: não sobrecarrega o servidor nem o serviço de geolocalização
      setBulk({ done: i + 1, total: targets.length });
    }
    setBulk(null);
  }

  async function add(domain: string) {
    setAdding(true);
    setAddError(null);
    try {
      saveScan(await scanDomain(domain));
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Falha no scan");
    } finally {
      setAdding(false);
    }
  }

  function remove(domain: string) {
    if (window.confirm(`Remover ${domain} dos ativos?\nO histórico de scans deste domínio será apagado.`)) {
      removeDomain(domain);
    }
  }

  const bulkRunning = bulk !== null;
  const fmt = (n: number) => String(n);

  return (
    <main className="px-4 py-5 md:px-8 md:py-6 space-y-4">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg">Ativos</h1>
          <p className="text-sm text-muted mt-0.5">
            {summary.n ? `${summary.n} ${summary.n === 1 ? "domínio monitorado" : "domínios monitorados"}` : "Domínios monitorados"}
            {addError && <span role="alert" className="text-bad"> · Erro: {addError}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <div className="flex-1 min-w-0 lg:w-[22rem]">
            <DomainScanner onScan={add} isLoading={adding} />
          </div>
          {summary.n > 0 &&
            (bulkRunning ? (
              <button
                type="button"
                onClick={() => (cancelBulk.current = true)}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 sm:px-3.5 py-2.5 text-sm text-muted hover:text-fg"
              >
                <RefreshCw size={16} className="animate-spin text-accent" />
                <span className="tabular-nums">{bulk.done}/{bulk.total}</span>
                <span className="hidden sm:inline">· Cancelar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={rescanAll}
                disabled={busy.size > 0 || adding}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 sm:px-3.5 py-2.5 text-sm text-muted hover:text-fg hover:border-line-strong transition-colors disabled:opacity-40"
              >
                <RefreshCw size={16} />
                <span className="hidden sm:inline">Reescanear todos</span>
              </button>
            ))}
        </div>
      </header>

      {summary.n === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-panel/60 px-6 py-16 text-center">
          <Boxes size={28} className="mx-auto text-dim" strokeWidth={1.5} />
          <p className="text-sm text-fg mt-3">Nenhum ativo ainda</p>
          <p className="text-xs text-dim mt-1">Escaneie um domínio no campo acima e ele aparece aqui.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <SummaryCard icon={Boxes} label="Domínios" value={fmt(summary.n)} sub="no histórico deste navegador" tone="text-fg" />
            <SummaryCard
              icon={Gauge}
              label="Nota média"
              value={fmt(summary.avg)}
              sub={scoreTier(summary.avg).label}
              tone={scoreTier(summary.avg).text}
            />
            <SummaryCard
              icon={AlertTriangle}
              label="Com falhas"
              value={fmt(summary.withFails)}
              sub={summary.withFails ? "precisam de atenção" : "nenhuma falha"}
              tone={summary.withFails ? "text-bad" : "text-ok"}
            />
            <SummaryCard
              icon={ShieldAlert}
              label="Certificados"
              value={fmt(summary.certAlerts)}
              sub={summary.certAlerts ? "inválidos ou vencendo em < 30 dias" : "todos em dia"}
              tone={summary.certAlerts ? "text-warn" : "text-ok"}
            />
          </div>

          <Panel
            title="Lista de ativos"
            subtitle={query ? `${visible.length} de ${assets.length}` : "Clique num domínio para abrir no painel"}
            actions={
              <label className="inline-flex items-center gap-2 text-xs text-dim">
                <span className="hidden sm:inline">Ordenar</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-xs text-fg outline-none focus:border-accent/50"
                >
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                    <option key={k} value={k}>
                      {SORT_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
            }
            bodyClassName="!px-0 !pb-0"
          >
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas/40 px-3 py-1.5 focus-within:border-accent/50">
                <Search size={14} className="text-dim" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filtrar domínios"
                  aria-label="Filtrar domínios"
                  className="flex-1 bg-transparent text-sm text-fg placeholder:text-dim outline-none"
                />
              </div>
            </div>

            {/* cabeçalho das colunas (desktop) */}
            <div className={`hidden lg:grid gap-x-4 px-4 py-2 border-y border-line/70 text-[11px] uppercase tracking-wider text-dim ${GRID}`}>
              <span>Domínio</span>
              <span>Nota</span>
              <span>Tendência</span>
              <span>Certificado</span>
              <span>Problemas</span>
              <span>Servidor</span>
              <span className="text-right">Ações</span>
            </div>

            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-dim">Nenhum domínio corresponde ao filtro.</p>
            ) : (
              <ul className="divide-y divide-line/60 border-t border-line/70 lg:border-t-0">
                {visible.map((a) => (
                  <AssetRow
                    key={a.domain}
                    asset={a}
                    nowMinute={nowMinute}
                    busy={busy.has(a.domain)}
                    error={errors[a.domain]}
                    disabled={bulkRunning}
                    onRescan={() => rescan(a.domain)}
                    onRemove={() => remove(a.domain)}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </main>
  );
}
