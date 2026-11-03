"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface DomainScannerProps {
  onScan: (domain: string) => void;
  isLoading: boolean;
  initialValue?: string;
}

export default function DomainScanner({ onScan, isLoading, initialValue = "" }: DomainScannerProps) {
  const [domain, setDomain] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim() || isLoading) return;
    onScan(domain.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative flex items-center gap-2 rounded-xl border border-line bg-panel/90 pl-3 pr-1.5 py-1.5 transition-colors focus-within:border-accent/50 focus-within:ring-4 focus-within:ring-accent/10 overflow-hidden">
        <Search size={16} className="text-dim shrink-0" />
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-label="Domínio para escanear"
          placeholder="ex.: github.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          disabled={isLoading}
          className="flex-1 min-w-0 bg-transparent text-sm text-fg placeholder:text-dim outline-none py-1 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !domain.trim()}
          className="shrink-0 rounded-lg bg-accent px-3 sm:px-4 py-1.5 text-sm font-medium text-canvas transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
        >
          {isLoading ? "Escaneando…" : "Escanear"}
        </button>

        {/* barra de progresso indeterminada */}
        {isLoading && (
          <span className="absolute bottom-0 left-0 h-0.5 w-1/3 bg-accent/80 animate-[progress_1.2s_ease-in-out_infinite]" />
        )}
      </div>
    </form>
  );
}
