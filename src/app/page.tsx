"use client";

import type { ActiveInfo, ScanResult, SecurityCheck } from "@/types/scan";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Globe2, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import SecurityScore from "@/components/SecurityScore";
import StatsCards from "@/components/StatsCards";
import SecurityStatus from "@/components/SecurityStatus";
import DomainScanner from "@/components/DomainScanner";
import { DnsDetails, TlsDetails } from "@/components/ScanDetails";
import ServerMap, { Legend, ServerList, scanKey } from "@/components/ServerMap";
import Globe, { createCamera, type GlobeCamera } from "@/components/globe/Globe";
import Panel from "@/components/ui/Panel";
import VulnsPanel from "@/components/deep/VulnsPanel";
import SurfacePanel from "@/components/deep/SurfacePanel";
import ReputationPanel from "@/components/deep/ReputationPanel";
import ActivePanel from "@/components/deep/ActivePanel";
import { scanDomain, scanSurface } from "@/lib/services/scanner";
import { mergeChecks } from "@/lib/scoring";
import { getLastScan, getLatestFor, saveScan } from "@/lib/storage/scanHistory";

/** Alvo usado quando o AEGIS roda em localhost/IP e não há domínio próprio para se auto-diagnosticar. */
const FALLBACK_TARGET = process.env.NEXT_PUBLIC_AEGIS_DEFAULT_TARGET || "github.com";

const MAP_MS = 750;
const MAP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

type MapState = "closed" | "opening" | "open" | "closing";
type Rect = { top: number; left: number; width: number; height: number };

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
  const [mapState, setMapState]     = useState<MapState>("closed");
  const [overlayRect, setOverlayRect] = useState<Rect | null>(null); // null = tela cheia
  const [error, setError]           = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isSelfScan, setIsSelfScan] = useState(false);
  const booted = useRef(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const camera = useRef<GlobeCamera>(createCamera()); // rotação compartilhada: painel ↔ tela cheia
  const mapTimer = useRef<number | undefined>(undefined);
  const [surfaceRunning, setSurfaceRunning] = useState(false);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [flashIssues, setFlashIssues] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);

  /** card "Problemas abertos": filtra a lista e rola até ela */
  const openIssues = useCallback(() => {
    setIssuesOnly(true);
    const el = document.getElementById("verificacoes");
    el?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    setFlashIssues(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashIssues(false), 1400);
  }, []);
  /** scan exibido agora: etapas em segundo plano só aplicam o resultado se ele ainda for o mesmo */
  const current = useRef<ScanResult | null>(null);

  const show = useCallback((r: ScanResult | null) => {
    current.current = r;
    setScanResult(r);
  }, []);

  /** Aplica uma etapa posterior (superfície, testes ativos) ao scan exibido e salva no histórico. */
  const patch = useCallback(
    (forKey: string, update: (r: ScanResult) => ScanResult) => {
      const r = current.current;
      if (!r || scanKey(r) !== forKey) return; // o usuário já está vendo outro scan
      const next = update(r);
      show(next);
      saveScan(next);
    },
    [show],
  );

  const runSurface = useCallback(
    async (r: ScanResult) => {
      const key = scanKey(r);
      setSurfaceRunning(true);
      setSurfaceError(null);
      try {
        const { surface, checks } = await scanSurface(r.domain);
        patch(key, (cur) => mergeChecks(cur, ["surface"], checks, { surface }));
      } catch (err) {
        if (current.current && scanKey(current.current) === key) {
          setSurfaceError(err instanceof Error ? err.message : "Falha ao mapear a superfície");
        }
      } finally {
        setSurfaceRunning(false);
      }
    },
    [patch],
  );

  const applyActive = useCallback(
    (active: ActiveInfo, checks: SecurityCheck[]) => {
      const r = current.current;
      if (r) patch(scanKey(r), (cur) => mergeChecks(cur, ["exposure"], checks, { active }));
    },
    [patch],
  );

  const slotRect = (): Rect | null => {
    const r = slotRef.current?.getBoundingClientRect();
    return r && r.width > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
  };
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const openMap = useCallback(() => {
    window.clearTimeout(mapTimer.current);
    const from = slotRect();
    if (!from || reducedMotion()) {
      setOverlayRect(null);
      setMapState("open");
      return;
    }
    // começa exatamente em cima do globo do painel e, no frame seguinte, anima até a tela cheia
    setOverlayRect(from);
    setMapState("opening");
    requestAnimationFrame(() => requestAnimationFrame(() => setOverlayRect(null)));
    mapTimer.current = window.setTimeout(() => setMapState("open"), MAP_MS);
  }, []);

  const closeMap = useCallback(() => {
    window.clearTimeout(mapTimer.current);
    const to = slotRect();
    if (!to || reducedMotion()) {
      setMapState("closed");
      return;
    }
    setMapState("closing");
    setOverlayRect(to);
    mapTimer.current = window.setTimeout(() => {
      setMapState("closed");
      setOverlayRect(null);
    }, MAP_MS);
  }, []);

  // Esc fecha o mapa; trava a rolagem da página enquanto ele está aberto
  useEffect(() => {
    if (mapState === "closed") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMap();
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
    };
  }, [mapState, closeMap]);

  useEffect(
    () => () => {
      window.clearTimeout(mapTimer.current);
      window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const runScan = useCallback(async (domain: string, self = false) => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    setSurfaceError(null);
    try {
      const result = await scanDomain(domain);
      show(result);
      setIsSelfScan(self);
      saveScan(result);
      setLoading(false);
      void runSurface(result); // subdomínios demoram mais: chegam depois, sem travar o painel
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no scan");
    } finally {
      setLoading(false);
    }
  }, [show, runSurface]);

  // Ao abrir: mostra o último scan salvo; sem histórico, faz o auto-diagnóstico do próprio domínio.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    // /?d=dominio (vindo da página Ativos) abre o último scan salvo daquele domínio
    const wanted = new URLSearchParams(window.location.search).get("d");
    const last = (wanted && getLatestFor(wanted.toLowerCase())) || getLastScan();
    if (last) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única de storage externo
      show(last);
      return;
    }
    const self = selfDomain();
    void runScan(self ?? FALLBACK_TARGET, self !== null);
  }, [runScan, show]);

  const mapActive = mapState === "opening" || mapState === "open"; // painel some / mapa em foco
  const dataKey = loading ? "loading" : scanResult ? scanKey(scanResult) : "empty";

  return (
    <main className="app-bg min-h-dvh relative lg:h-dvh lg:overflow-hidden">
      {/* Modo mapa: o globo sai do painel e cresce até a tela cheia (e volta ao fechar) */}
      {mapState !== "closed" && (
        <div
          className="fixed z-20"
          style={{
            ...(overlayRect ?? { top: 0, left: 0, width: "100vw", height: "100dvh" }),
            transition: `top ${MAP_MS}ms ${MAP_EASE}, left ${MAP_MS}ms ${MAP_EASE}, width ${MAP_MS}ms ${MAP_EASE}, height ${MAP_MS}ms ${MAP_EASE}`,
          }}
        >
          <Globe
            geo={loading ? undefined : scanResult?.geo}
            focusKey={dataKey}
            camera={camera}
            traffic="high"
            touchAction="none"
            className="h-full w-full"
          />
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:h-dvh">
        <Sidebar className={`transition-opacity duration-500 ${mapActive ? "opacity-0 pointer-events-none" : ""}`} />

        <section className="flex-1 min-h-0 min-w-0 flex flex-col px-4 py-5 md:px-8 md:py-6 lg:overflow-hidden">
          <header className="relative z-30 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 md:mb-6">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-fg">
                {mapActive ? "Mapa global" : "Visão geral"}
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
              {scanResult && !loading && !mapActive && (
                <Link
                  href={`/report?d=${encodeURIComponent(scanResult.domain)}`}
                  aria-label={`Relatório de ${scanResult.domain}`}
                  title="Relatório (PDF)"
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 sm:px-3.5 py-2.5 text-sm text-muted hover:text-fg hover:border-line-strong transition-colors whitespace-nowrap"
                >
                  <FileText size={16} />
                  <span className="hidden sm:inline">Relatório</span>
                </Link>
              )}
              <button
                type="button"
                onClick={mapActive ? closeMap : openMap}
                aria-label={mapActive ? "Fechar mapa" : "Abrir mapa"}
                aria-pressed={mapActive}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 sm:px-3.5 py-2.5 text-sm text-muted hover:text-fg hover:border-line-strong transition-colors whitespace-nowrap"
              >
                {mapActive ? <X size={16} /> : <Globe2 size={16} />}
                <span className="hidden sm:inline">{mapActive ? "Fechar mapa" : "Mapa"}</span>
              </button>
            </div>
          </header>

          {/* O painel continua montado (só some) para o globo saber para onde voltar ao fechar o mapa */}
          <div
            aria-hidden={mapActive}
            className={`space-y-4 pb-6 transition-opacity duration-500 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:-mr-2 lg:pr-2 ${
              mapActive ? "opacity-0 pointer-events-none" : ""
            }`}
          >
            <StatsCards data={scanResult ?? undefined} isLoading={loading} onOpenIssues={openIssues} />

            {/*
              Duas colunas independentes no xl (assim o globo não deixa um vazio embaixo dele).
              Abaixo do xl as colunas viram "contents" e os blocos seguem a ordem do mobile via order-*.
            */}
            <div className="flex flex-col gap-4 xl:grid xl:grid-cols-3 xl:items-start">
              <div className="contents xl:block xl:col-span-2 xl:space-y-4 min-w-0">
                <div className="order-1 xl:order-none grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Coluna esquerda: define a altura da linha */}
                  <div className="space-y-4 min-w-0">
                    <SecurityScore
                      score={scanResult?.score}
                      grade={scanResult?.grade}
                      capReason={scanResult?.capReason}
                      isLoading={loading}
                    />
                    <TlsDetails data={scanResult ?? undefined} isLoading={loading} />
                    <DnsDetails data={scanResult ?? undefined} isLoading={loading} />
                  </div>
                  {/* Coluna direita: no desktop acompanha a altura da esquerda e rola por dentro */}
                  <div className="relative min-w-0 md:min-h-[500px] scroll-mt-4">
                    <SecurityStatus
                      id="verificacoes"
                      checks={scanResult?.checks}
                      isLoading={loading}
                      onlyIssues={issuesOnly}
                      onOnlyIssuesChange={setIssuesOnly}
                      className={`md:absolute md:inset-0 scroll-mt-4 transition-shadow duration-500 ${
                        flashIssues ? "ring-2 ring-accent/60" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Análise aprofundada */}
                <div className="order-3 xl:order-none space-y-4 min-w-0">
                  <VulnsPanel key={`v-${dataKey}`} data={scanResult ?? undefined} isLoading={loading} />
                  <SurfacePanel
                    key={`s-${dataKey}`}
                    data={loading ? undefined : scanResult ?? undefined}
                    running={surfaceRunning}
                    error={surfaceError}
                    onRun={() => scanResult && void runSurface(scanResult)}
                  />
                </div>
              </div>

              <div className="contents xl:block xl:space-y-4 min-w-0">
                <div className="order-2 xl:order-none min-w-0">
                  <ServerMap
                    data={scanResult ?? undefined}
                    isLoading={loading}
                    slotRef={slotRef}
                    camera={camera}
                    globeHidden={mapState !== "closed"}
                  />
                </div>
                <div className="order-4 xl:order-none space-y-4 min-w-0">
                  <ActivePanel key={`a-${scanResult?.domain ?? ""}`} data={loading ? undefined : scanResult ?? undefined} onResult={applyActive} />
                  <ReputationPanel data={scanResult ?? undefined} isLoading={loading} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Lista de servidores flutuante (só depois que o globo terminou de crescer) */}
      {mapState === "open" && (
        <div className="fixed z-30 bottom-4 right-4 left-4 sm:left-auto sm:w-96 max-h-[45dvh] flex animate-fade-in">
          <Panel
            title={scanResult ? scanResult.domain : "Mapa global"}
            subtitle="Arraste para girar · Esc para fechar"
            className="w-full bg-panel/95"
            bodyClassName="overflow-y-auto space-y-3"
          >
            <Legend />
            {scanResult?.geo ? (
              <ServerList geo={scanResult.geo} />
            ) : (
              <p className="text-sm text-dim">Faça um scan para ver os servidores no mapa.</p>
            )}
          </Panel>
        </div>
      )}
    </main>
  );
}
