"use client";

import type { ScanResult } from "@/types/scan";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import SecurityScore from "@/components/SecurityScore";
import StatsCards from "@/components/StatsCards";
import ThreatFeed from "@/components/ThreatFeed";
import SecurityStatus from "@/components/SecurityStatus";
import DomainScanner from "@/components/DomainScanner";
import CyberGlobeBackground from "@/components/backgrounds/Background";
import { scanDomain } from "@/lib/services/scanner";

export default function Home() {
  const [loading, setLoading]       = useState(false);
  const [isFocusMode, setFocusMode] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const handleScan = async (domain: string) => {
    if (!domain) return;

    setLoading(true);
    setError(null);
    try {
      const result = await scanDomain(domain);
      setScanResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen text-white antialiased relative overflow-hidden bg-[#050507]">

      {/* Globo: sempre atrás */}
      <CyberGlobeBackground isFocusMode={isFocusMode} />

      {/* HUD: no focus mode deixa os cliques passarem para o globo (drag) */}
      <div
        className={`flex flex-col lg:flex-row h-screen relative z-10 ${
          isFocusMode ? "pointer-events-none" : ""
        }`}
      >

        {!isFocusMode && <Sidebar />}

        <section className="flex-1 min-h-0 p-4 md:p-8 overflow-hidden relative flex flex-col">

          {/* Header */}
          <div className="pointer-events-auto flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-800/30 pb-6 mb-8">
            <div>
              <h2 className="text-xl font-mono font-black tracking-widest text-zinc-100 uppercase">
                {isFocusMode ? "// GLOBAL_MATRIX" : "// AEGIS_CORE"}
              </h2>
              <p className="text-cyan-400 text-[10px] font-mono uppercase tracking-wider animate-pulse mt-0.5">
                SYS_STATUS: ACTIVE {"//"} MODE: {isFocusMode ? "FOCUS_STREAM" : "MONITORING"}
              </p>
              {scanResult && !error && (
                <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider mt-1">
                  TARGET: {scanResult.domain}
                </p>
              )}
              {error && (
                <p role="alert" className="text-rose-500 text-[10px] font-mono uppercase tracking-wider mt-1">
                  ERR: {error}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex-1 md:w-96">
                <DomainScanner onScan={handleScan} isLoading={loading} />
              </div>
              <button
                type="button"
                onClick={() => setFocusMode(f => !f)}
                className="font-mono text-[9px] border border-cyan-500/30 bg-zinc-950/80 px-4 py-2 hover:bg-cyan-500/10 text-cyan-400 transition-all uppercase tracking-widest whitespace-nowrap"
              >
                {isFocusMode ? "[ EXIT_FOCUS ]" : "[ FOCUS_MODE ]"}
              </button>
            </div>
          </div>

          {/* Content */}
          {!isFocusMode ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-6 animate-fadeIn">
              <StatsCards data={scanResult ?? undefined} isLoading={loading} />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SecurityScore score={scanResult?.score} isLoading={loading} />
                    <SecurityStatus headers={scanResult?.headers} isLoading={loading} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFocusMode(true)}
                    className="w-full text-left p-8 bg-zinc-950/70 border border-zinc-800/40 rounded-lg cursor-pointer group hover:border-cyan-500/30 transition-all"
                  >
                    <h3 className="text-[10px] font-mono font-black text-zinc-500 group-hover:text-cyan-400 uppercase tracking-[0.2em]">
                      {"// GEOLOCATION_TELEMETRY_OVERLAY"}
                    </h3>
                    <div className="text-center text-[10px] font-mono text-cyan-500/40 uppercase mt-4 animate-pulse">
                      ⚡ CLICK TO EXPAND GLOBAL THREAT MATRIX ⚡
                    </div>
                  </button>
                </div>
                <div className="xl:col-span-1">
                  <ThreatFeed isLoading={loading} />
                </div>
              </div>
            </div>
          ) : (
            /* Focus mode: feed no canto, globo visível e arrastável atrás */
            <div className="flex-1 min-h-0 flex items-end justify-end p-4 animate-fadeIn">
              <div className="pointer-events-auto w-full max-w-md h-[440px]">
                <ThreatFeed isLoading={loading} />
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
