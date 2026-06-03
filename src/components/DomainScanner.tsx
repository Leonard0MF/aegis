"use client";

import { useState } from "react";

interface DomainScannerProps {
  onScan: (domain: string) => void;
  isLoading: boolean;
}

export default function DomainScanner({ onScan, isLoading }: DomainScannerProps) {
  const [domain, setDomain] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim() || isLoading) return;
    onScan(domain.trim());
  };

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} className="w-full relative group">
        {/* Container do Input estilo Terminal HUD */}
        <div className="relative flex items-center bg-zinc-950/40 border border-zinc-800/80 rounded p-1 backdrop-blur-md transition-all duration-300 focus-within:border-cyan-500/40 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.1)]">
          
          {/* Cantoneiras Estéticas de Interface nos cantos do formulário */}
          <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-zinc-700"></div>
          <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-zinc-700"></div>
          <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-zinc-700"></div>
          <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-zinc-700"></div>

          {/* Indicador de Prompt de Comando */}
          <span className="font-mono text-[10px] text-cyan-500/70 px-3 select-none tracking-wider animate-pulse">
            [SYS_RECON]&gt;
          </span>

          <input
            type="text"
            placeholder="TARGET_DOMAIN_OR_HOST..."
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-transparent border-0 text-zinc-100 font-mono text-xs tracking-widest placeholder-zinc-800 uppercase outline-none py-1.5 disabled:opacity-40"
          />

          {/* Botão de Execução estilo Matrix/Cybersec */}
          <button
            type="submit"
            disabled={isLoading || !domain.trim()}
            className="relative overflow-hidden font-mono text-[9px] font-bold tracking-widest uppercase px-4 py-1.5 rounded bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 transition-all duration-200 hover:text-cyan-400 hover:border-cyan-500/50 active:scale-95 disabled:opacity-20 disabled:hover:text-zinc-400 disabled:hover:border-zinc-800 disabled:pointer-events-none"
          >
            {isLoading && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-[loading_1.5s_infinite_linear]" />
            )}
            {isLoading ? "SCANNING" : "EXECUTE"}
          </button>
        </div>
      </form>

      {/* Logs do Scanner que aparecem logo abaixo do input em tempo de execução */}
      {isLoading && (
        <div className="absolute top-full left-0 right-0 mt-3 p-3 bg-black/60 border border-cyan-500/20 rounded backdrop-blur-md space-y-1 font-mono text-[10px] text-cyan-400/80 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">●</span>
            <span className="tracking-wider uppercase">// INITIATING PACKET CAPTURE ON TARGET</span>
          </div>
          <div className="text-zinc-500 pl-4 animate-pulse delay-75">
            &gt; RESOLVING DNS RECORDS... DONE
          </div>
          <div className="text-zinc-500 pl-4 animate-pulse delay-150">
            &gt; INTERCEPTING SECURITY HEADERS... CONNECTED
          </div>
          <div className="text-zinc-500 pl-4 animate-pulse delay-300">
            &gt; EVALUATING CRYPTOGRAPHIC MATRIX... ALIGNED
          </div>
        </div>
      )}
    </div>
  );
}