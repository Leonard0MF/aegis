"use client";

import type { ScanResult } from "@/types/scan";
import { useCallback, useEffect, useRef, useState } from "react";
import { Globe2, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import SecurityScore from "@/components/SecurityScore";
import StatsCards from "@/components/StatsCards";
import ThreatFeed from "@/components/ThreatFeed";
import SecurityStatus from "@/components/SecurityStatus";
import DomainScanner from "@/components/DomainScanner";
import { DnsDetails, TlsDetails } from "@/components/ScanDetails";
import CyberGlobeBackground from "@/components/backgrounds/Background";
import { scanDomain } from "@/lib/services/scanner";
import { getLastScan, saveScan } from "@/lib/storage/scanHistory";

/** Alvo usado quando o AEGIS roda em localhost/IP e não há domínio próprio para se auto-diagnosticar. */
const FALLBACK_TARGET = process.env.NEXT_PUBLIC_AEGIS_DEFAULT_TARGET || "github.com";

/** Domínio onde o AEGIS está hospedado, ou null se for localhost / IP / host interno. */
function selfDomain(): string | null {
  const host = window.location.hostname;
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || /\.(local|localhost)$/.test(host)) {
    return null;
  }
  return host;
}

export default function Home() {
  const [loading, setLoading]       = useState(false);
  const [isFocusMode, setFocusMode] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isSelfScan, setIsSelfScan] = useState(false);
  const booted = useRef(false);

  const runScan = useCallback(async (domain: string, self = false) => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    try {
      const result = await scanDomain(domain);
      setScanResult(result);
      setIsSelfScan(self);
      saveScan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no scan");
    } finally {
      setLoading(false);
    }
  }, []);

  // Ao abrir: mostra o último scan salvo; sem histórico, faz o auto-diagnóstico do próprio domínio.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const last = getLastScan();
    if (last) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única de storage externo
      setScanResult(last);
      return;
    }
    const self = selfDomain();
    void runScan(self ?? FALLBACK_TARGET, self !== null);
  }, [runScan]);

  return (
    <main className="min-h-dvh relative bg-canvas lg:h-dvh lg:overflow-hidden">
      <CyberGlobeBackground isFocusMode={isFocusMode} />

      {/* No modo globo, os cliques passam para o canvas (arrastar) */}
      <div className={`flex flex-col lg:flex-row relative z-10 lg:h-dvh ${isFocusMode ? "h-dvh pointer-events-none" : ""}`}>
        {!isFocusMode && <Sidebar />}

        <section className="flex-1 min-h-0 min-w-0 flex flex-col px-4 py-5 md:px-8 md:py-6 lg:overflow-hidden">
          <header className="pointer-events-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 md:mb-6">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-fg">
                {isFocusMode ? "Mapa global" : "Visão geral"}
              </h1>
              <p className="text-sm text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {error ? (
                  <span role="alert" className="text-bad">Erro: {error}</span>
                ) : loading ? (
                  "Escaneando…"
                ) : scanResult ? (
                  <>
                    <span className="text-fg">{scanResult.domain}</span>
                    {isSelfScan && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent ring-1 ring-inset ring-accent/20">
                        auto-diagnóstico
                      </span>
                    )}
                    <span className="text-dim">{new Date(scanResult.scannedAt).toLocaleString("pt-BR")}</span>
                  </>
                ) : (
                  "Nenhum scan ainda"
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
              <div className="flex-1 min-w-0 lg:w-[26rem]">
                <DomainScanner
                  key={scanResult?.domain ?? "empty"}
                  initialValue={scanResult?.domain ?? ""}
                  onScan={(d) => runScan(d)}
                  isLoading={loading}
                />
              </div>
              <button
                type="button"
                onClick={() => setFocusMode((f) => !f)}
                aria-label={isFocusMode ? "Fechar mapa" : "Abrir mapa"}
                className="pointer-events-auto shrink-0 inline-flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 sm:px-3.5 py-2.5 text-sm text-muted hover:text-fg hover:border-line-strong transition-colors whitespace-nowrap"
              >
                {isFocusMode ? <X size={16} /> : <Globe2 size={16} />}
                <span className="hidden sm:inline">{isFocusMode ? "Fechar mapa" : "Mapa"}</span>
              </button>
            </div>
          </header>

          {!isFocusMode ? (
            <div className="space-y-4 pb-6 animate-fade-in lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:-mr-2 lg:pr-2">
              <StatsCards data={scanResult ?? undefined} isLoading={loading} />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Coluna esquerda: define a altura da linha */}
                  <div className="space-y-4 min-w-0">
                    <SecurityScore score={scanResult?.score} grade={scanResult?.grade} isLoading={loading} />
                    <TlsDetails data={scanResult ?? undefined} isLoading={loading} />
                    <DnsDetails data={scanResult ?? undefined} isLoading={loading} />
                  </div>
                  {/* Coluna direita: no desktop acompanha a altura da esquerda e rola por dentro */}
                  <div className="relative min-w-0 md:min-h-[500px]">
                    <SecurityStatus
                      checks={scanResult?.checks}
                      isLoading={loading}
                      className="md:absolute md:inset-0"
                    />
                  </div>
                </div>
                <div className="relative min-w-0 h-[420px] xl:h-auto">
                  <ThreatFeed isLoading={loading} className="h-full xl:absolute xl:inset-0" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex items-end justify-end animate-fade-in">
              <div className="pointer-events-auto w-full sm:max-w-sm h-[300px] sm:h-[420px]">
                <ThreatFeed isLoading={false} className="h-full" />
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
