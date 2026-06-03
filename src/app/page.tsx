"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import SecurityScore from "@/components/SecurityScore";
import StatsCards from "@/components/StatsCards";
import ThreatFeed from "@/components/ThreatFeed";
import SecurityStatus from "@/components/SecurityStatus";
import DomainScanner from "@/components/DomainScanner";
import CyberGlobeBackground from "@/components/backgrounds/Background";

export default function Home() {
  const [activeTab, setActiveTab]   = useState("/");
  const [loading, setLoading]       = useState(false);
  const [isFocusMode, setFocusMode] = useState(false);

  const [scanResult, setScanResult] = useState<any>({
    ip: "192.168.1.105",
    score: 87,
    headers: { csp: true, hsts: true, xFrameOptions: false },
  });

  const handleScan = (domain: string) => {
    if (!domain) return;
    setLoading(true);
    setTimeout(() => {
      setScanResult({
        ip: "104.26.10.228",
        score: 94,
        headers: { csp: true, hsts: true, xFrameOptions: true },
      });
      setLoading(false);
    }, 2500);
  };

  return (
    <main className="min-h-screen text-white antialiased relative overflow-hidden bg-[#050507]">

      {/* Globo: sempre atrás, z-index -10, nunca intercepta cliques */}
      <CyberGlobeBackground mode={activeTab} isFocusMode={isFocusMode} />

      {/* HUD: sempre na frente, sempre clicável */}
      <div className="flex flex-col lg:flex-row h-screen relative z-10">

        {!isFocusMode && <Sidebar setActiveTab={setActiveTab} />}

        <section className="flex-1 p-4 md:p-8 overflow-hidden relative flex flex-col">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-800/30 backdrop-blur-md pb-6 mb-8">
            <div>
              <h2 className="text-xl font-mono font-black tracking-widest text-zinc-100 uppercase">
                {activeTab === "/" ? "// AEGIS_CORE" : "// GLOBAL_MATRIX"}
              </h2>
              <p className="text-cyan-400 text-[10px] font-mono uppercase tracking-wider animate-pulse mt-0.5">
                SYS_STATUS: ACTIVE // MODE: {isFocusMode ? "FOCUS_STREAM" : "MONITORING"}
              </p>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex-1 md:w-96">
                <DomainScanner onScan={handleScan} isLoading={loading} />
              </div>
              <button
                onClick={() => setFocusMode(f => !f)}
                className="font-mono text-[9px] border border-cyan-500/30 bg-zinc-950/80 px-4 py-2 hover:bg-cyan-500/10 text-cyan-400 transition-all uppercase tracking-widest whitespace-nowrap"
              >
                {isFocusMode ? "[ EXIT_FOCUS ]" : "[ FOCUS_MODE ]"}
              </button>
            </div>
          </div>

          {/* Content */}
          {!isFocusMode ? (
            <div className="h-full overflow-y-auto space-y-6 animate-fadeIn">
              <StatsCards data={scanResult} isLoading={loading} />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SecurityScore score={scanResult?.score} isLoading={loading} />
                    <SecurityStatus headers={scanResult?.headers} isLoading={loading} />
                  </div>
                  <div
                    onClick={() => setActiveTab("/analytics")}
                    className="p-8 bg-zinc-950/20 border border-zinc-800/40 rounded-lg backdrop-blur-md cursor-pointer group hover:border-cyan-500/30 transition-all"
                  >
                    <h3 className="text-[10px] font-mono font-black text-zinc-500 group-hover:text-cyan-400 uppercase tracking-[0.2em]">
                      // GEOLOCATION_TELEMETRY_OVERLAY
                    </h3>
                    <div className="text-center text-[10px] font-mono text-cyan-500/40 uppercase mt-4 animate-pulse">
                      ⚡ CLICK TO EXPAND GLOBAL THREAT MATRIX ⚡
                    </div>
                  </div>
                </div>
                <div className="xl:col-span-1">
                  <ThreatFeed isLoading={loading} />
                </div>
              </div>
            </div>
          ) : (
            /* Focus mode: componentes ficam no canto, globo visível atrás */
            <div className="h-full flex items-end justify-end p-4 animate-fadeIn">
              <div className="w-full max-w-md h-[440px]">
                <ThreatFeed isLoading={loading} />
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}