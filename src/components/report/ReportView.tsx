"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import type { CheckStatus, ScanResult, SecurityCheck } from "@/types/scan";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/components/SecurityStatus";
import { scoreTier } from "@/lib/assets";
import { byDomain, certDaysLeft, diffScans, isOpen } from "@/lib/analytics";
import { remediationFor } from "@/lib/remediation";
import { useNowMinute, useScanHistory } from "@/lib/storage/useScanHistory";

/** Tons para papel branco (os do app são para fundo escuro). */
const INK: Record<CheckStatus, { label: string; text: string; chip: string }> = {
  fail: { label: "Falha", text: "text-red-700", chip: "bg-red-50 text-red-700 ring-red-200" },
  warn: { label: "Atenção", text: "text-amber-700", chip: "bg-amber-50 text-amber-800 ring-amber-200" },
  pass: { label: "OK", text: "text-teal-700", chip: "bg-teal-50 text-teal-800 ring-teal-200" },
  info: { label: "Info", text: "text-slate-600", chip: "bg-slate-50 text-slate-600 ring-slate-200" },
};
const TIER_INK = { ok: "text-teal-700", warn: "text-amber-700", bad: "text-red-700" };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Chip({ status }: { status: CheckStatus }) {
  const m = INK[status];
  return <span className={`inline-block rounded px-1.5 py-px text-[10px] font-medium ring-1 ring-inset ${m.chip}`}>{m.label}</span>;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-3 border-b border-slate-200 pb-1.5 text-sm font-semibold uppercase tracking-wider text-slate-500 break-after-avoid">{children}</h2>;
}

/** Problemas abertos do mais grave ao menos: falha antes de atenção, depois peso na nota. */
const byPriority = (a: SecurityCheck, b: SecurityCheck) =>
  Number(a.status !== "fail") - Number(b.status !== "fail") || (b.cap !== undefined ? 1 : 0) - (a.cap !== undefined ? 1 : 0) || b.weight - a.weight;

function Report({ r, previous, nowMinute }: { r: ScanResult; previous?: ScanResult; nowMinute: number }) {
  const tier = scoreTier(r.score);
  const open = r.checks.filter((c) => isOpen(c.status)).sort(byPriority);
  const fails = open.filter((c) => c.status === "fail").length;
  const kev = (r.vulns ?? []).filter((v) => v.kev);
  const diff = previous ? diffScans(previous, r) : null;
  const certDays = r.tls && nowMinute ? certDaysLeft(r, nowMinute * 60_000) : null;

  return (
    <article className="report-paper mx-auto w-full max-w-[210mm] bg-white px-8 py-10 text-slate-900 shadow-2xl sm:px-14 print:max-w-none print:px-0 print:py-0 print:shadow-none">
      {/* capa */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">AEGIS · Relatório de segurança</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight break-all">{r.domain}</h1>
          <p className="mt-1 text-sm text-slate-500">Scan de {fmt(r.scannedAt)} · IP {r.ip}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-mono text-5xl font-semibold tabular-nums ${TIER_INK[tier.tier]}`}>{r.score}</p>
          <p className="text-xs text-slate-500">de 100 · nota {r.grade}</p>
          <p className={`mt-1 text-xs font-medium ${TIER_INK[tier.tier]}`}>{tier.label}</p>
        </div>
      </header>

      {/* resumo */}
      <H2>Resumo executivo</H2>
      <div className="grid grid-cols-4 gap-3 text-center">
        {[
          { v: fails, l: "falhas", c: fails ? "text-red-700" : "text-slate-900" },
          { v: open.length - fails, l: "pontos de atenção", c: open.length - fails ? "text-amber-700" : "text-slate-900" },
          { v: kev.length, l: "CVEs exploradas (KEV)", c: kev.length ? "text-red-700" : "text-slate-900" },
          {
            v: certDays === null ? "—" : certDays,
            l: r.tls ? "dias de certificado" : "sem HTTPS",
            c: certDays === null || certDays < 30 ? "text-red-700" : "text-slate-900",
          },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-slate-200 px-2 py-3">
            <p className={`font-mono text-2xl tabular-nums ${s.c}`}>{s.v}</p>
            <p className="text-[11px] text-slate-500">{s.l}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-slate-700">
        {open.length === 0
          ? "Nenhum problema aberto foi encontrado nas verificações realizadas."
          : `Foram encontrados ${open.length} ${open.length === 1 ? "problema" : "problemas"}, ${fails} ${fails === 1 ? "deles grave" : "deles graves"}. `}
        {r.capReason && <>A nota foi limitada porque {r.capReason.charAt(0).toLowerCase() + r.capReason.slice(1)}. </>}
        {kev.length > 0 && <>Há {kev.length} {kev.length === 1 ? "vulnerabilidade" : "vulnerabilidades"} com exploração ativa confirmada: trate primeiro. </>}
        {diff && (
          <>
            Desde o scan anterior ({fmt(previous!.scannedAt)}), a nota {diff.scoreDelta === 0 ? "não mudou" : `${diff.scoreDelta > 0 ? "subiu" : "caiu"} ${Math.abs(diff.scoreDelta)} pontos`}
            , com {diff.fixed.length} {diff.fixed.length === 1 ? "correção" : "correções"} e {diff.introduced.length} {diff.introduced.length === 1 ? "problema novo" : "problemas novos"}.
          </>
        )}
      </p>

      {/* recomendações */}
      {open.length > 0 && (
        <>
          <H2>Recomendações (por prioridade)</H2>
          <ol className="space-y-3">
            {open.map((c, i) => {
              const fix = remediationFor(c.id);
              return (
                <li key={c.id} className="flex gap-3 break-inside-avoid">
                  <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-xs text-slate-400">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {c.label} <Chip status={c.status} />
                      <span className="ml-1.5 text-[11px] font-normal text-slate-400">{CATEGORY_LABEL[c.category]}</span>
                    </p>
                    <p className="text-xs text-slate-600">{c.detail}</p>
                    {fix && <p className="mt-0.5 text-xs text-slate-900"><span className="font-medium">Como corrigir:</span> {fix}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {/* CVEs KEV */}
      {kev.length > 0 && (
        <>
          <H2>Vulnerabilidades com exploração ativa</H2>
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr><th className="py-1 font-medium">CVE</th><th className="py-1 font-medium">Afeta</th><th className="py-1 font-medium">Corrigido em</th><th className="py-1 text-right font-medium">CVSS</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kev.map((v) => (
                <tr key={v.id} className="break-inside-avoid">
                  <td className="py-1.5 font-mono">{v.id}</td>
                  <td className="py-1.5">{v.affects}</td>
                  <td className="py-1.5">{v.fixedIn ?? "—"}</td>
                  <td className="py-1.5 text-right font-mono text-red-700">{v.cvss?.toFixed(1) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* infraestrutura */}
      <H2>Certificado e DNS</H2>
      <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-xs">
        {r.tls ? (
          <>
            <dt className="text-slate-500">Emissor</dt><dd>{r.tls.issuer}</dd>
            <dt className="text-slate-500">Validade</dt>
            <dd>{new Date(r.tls.validFrom).toLocaleDateString("pt-BR")} a {new Date(r.tls.validTo).toLocaleDateString("pt-BR")}</dd>
            <dt className="text-slate-500">Protocolo</dt><dd>{r.tls.protocol}{r.tls.cipher ? ` · ${r.tls.cipher}` : ""}</dd>
          </>
        ) : (
          <><dt className="text-slate-500">HTTPS</dt><dd className="text-red-700">indisponível</dd></>
        )}
        <dt className="text-slate-500">SPF</dt><dd className="break-all">{r.dns.spf ?? "ausente"}</dd>
        <dt className="text-slate-500">DMARC</dt><dd className="break-all">{r.dns.dmarc ?? "ausente"}</dd>
        <dt className="text-slate-500">MX</dt><dd className="break-all">{r.dns.mx.length ? r.dns.mx.join(", ") : "nenhum"}</dd>
        <dt className="text-slate-500">CAA</dt><dd className="break-all">{r.dns.caa.length ? [...new Set(r.dns.caa)].join(", ") : "nenhum"}</dd>
      </dl>

      {/* todas as verificações */}
      <H2>Todas as verificações</H2>
      <div className="columns-1 gap-8 sm:columns-2 print:columns-2">
        {CATEGORY_ORDER.map((cat) => {
          const items = r.checks.filter((c) => c.category === cat);
          if (!items.length) return null;
          return (
            <section key={cat} className="mb-4 break-inside-avoid">
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{CATEGORY_LABEL[cat]}</h3>
              <ul className="space-y-0.5">
                {items.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 text-xs">
                    <span>{c.label}</span>
                    <Chip status={c.status} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <footer className="mt-10 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
        Gerado pelo AEGIS em {nowMinute ? fmt(new Date(nowMinute * 60_000).toISOString()) : "—"}. Verificações passivas e públicas;
        testes ativos só com verificação de propriedade do domínio. Resultado reflete o momento do scan.
      </footer>
    </article>
  );
}

export default function ReportView({ domain }: { domain: string }) {
  const history = useScanHistory();
  const nowMinute = useNowMinute();
  const scans = byDomain(history).get(domain.toLowerCase());
  const r = scans?.[scans.length - 1];
  const previous = scans && scans.length > 1 ? scans[scans.length - 2] : undefined;

  return (
    <main className="min-h-dvh bg-canvas px-3 py-6 sm:py-10 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 print:hidden">
        <Link href={r ? `/?d=${encodeURIComponent(r.domain)}` : "/"} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft size={16} /> Voltar
        </Link>
        {r && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-sm font-medium text-canvas hover:opacity-90"
          >
            <Printer size={16} /> Salvar PDF
          </button>
        )}
      </div>
      {r ? (
        <Report r={r} previous={previous} nowMinute={nowMinute} />
      ) : (
        <div className="mx-auto max-w-[210mm] rounded-2xl border border-dashed border-line-strong bg-panel/60 px-6 py-16 text-center">
          <p className="text-sm text-fg">{!nowMinute ? "Carregando…" : `Nenhum scan de ${domain || "domínio"} neste navegador`}</p>
          <p className="mt-1 text-xs text-dim">Escaneie o domínio na Visão geral e volte aqui para gerar o relatório.</p>
        </div>
      )}
    </main>
  );
}
