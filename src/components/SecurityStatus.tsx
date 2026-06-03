"use client";

type StatusType = "ok" | "warning" | "critical";

interface SecurityStatusProps {
  headers?: {
    csp: boolean;
    hsts: boolean;
    xFrameOptions: boolean;
  };
  isLoading: boolean;
}

export default function SecurityStatus({ headers, isLoading }: SecurityStatusProps) {
  // Converte os dados reais recebidos do scanner para a estrutura visual do componente
  const items = headers 
    ? [
        { label: "CONTENT_SECURITY_POLICY (CSP)", status: headers.csp ? "ok" : "critical" as StatusType, text: headers.csp ? "ENFORCED" : "MISSING" },
        { label: "STRICT_TRANSPORT_SECURITY (HSTS)", status: headers.hsts ? "ok" : "warning" as StatusType, text: headers.hsts ? "ACTIVE" : "NO_PRELOAD" },
        { label: "ANTI_CLICKJACKING (X-FRAME)", status: headers.xFrameOptions ? "ok" : "critical" as StatusType, text: headers.xFrameOptions ? "DENY_CONFIGURED" : "BYPASS_RISK" },
        { label: "NETWORK_FIREWALL_INTEGRITY", status: "ok" as StatusType, text: "ROUTING_STABLE" },
      ]
    : [
        { label: "FIREWALL_INSPECTION_GATE", status: "ok" as StatusType, text: "OPERATIONAL" },
        { label: "SSL_TLS_CRYPTO_SUITE", status: "ok" as StatusType, text: "PROTECTED_TLS1.3" },
        { label: "THREAT_DETECTION_DAEMON", status: "warning" as StatusType, text: "ELEVATED_ACTIVITY" },
        { label: "INFRASTRUCTURE_METRICS", status: "ok" as StatusType, text: "STABLE" },
      ];

  const getStatusStyles = (status: StatusType) => {
    switch (status) {
      case "ok":
        return {
          text: "text-emerald-400",
          bg: "bg-emerald-500",
          glow: "shadow-[0_0_10px_rgba(16,185,129,0.5)]",
          border: "border-emerald-500/20"
        };
      case "warning":
        return {
          text: "text-amber-400",
          bg: "bg-amber-500",
          glow: "shadow-[0_0_10px_rgba(245,158,11,0.5)]",
          border: "border-amber-500/20"
        };
      case "critical":
        return {
          text: "text-rose-500",
          bg: "bg-rose-500",
          glow: "shadow-[0_0_10px_rgba(239,68,68,0.5)]",
          border: "border-rose-500/20"
        };
    }
  };

  return (
    <div className="p-6 bg-zinc-950/40 border border-zinc-800/60 rounded-lg backdrop-blur-md relative overflow-hidden min-h-[190px] flex flex-col justify-between">
      
      {/* Cantoneiras HUD Estilo Terminal Tático */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-800"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-zinc-800"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-zinc-800"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-800"></div>

      {/* Header do Card */}
      <div className="border-b border-zinc-900 pb-2 mb-4">
        <h3 className="text-[10px] font-mono font-black tracking-widest text-zinc-500 uppercase">
          // CRITICAL_SUBSYSTEM_MATRIX
        </h3>
      </div>

      {/* Grid de Sub-módulos */}
      <div className="space-y-3.5 flex-1 flex flex-col justify-center">
        {isLoading ? (
          /* Estado Carregando: Esqueletos de Linha Ciano Pulsantes */
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between animate-pulse">
              <div className="space-y-1 w-2/3">
                <div className="h-2 bg-zinc-900 rounded w-3/4"></div>
                <div className="h-1.5 bg-cyan-950 rounded w-1/2"></div>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-900"></div>
            </div>
          ))
        ) : (
          /* Estado Ativo com Dados de Diagnóstico */
          items.map((item) => {
            const styles = getStatusStyles(item.status);
            return (
              <div 
                key={item.label} 
                className={`flex items-center justify-between p-2 rounded bg-zinc-900/10 border ${styles.border} backdrop-blur-sm transition-all duration-300 hover:bg-zinc-900/30 group`}
              >
                <div className="font-mono">
                  <p className="text-[9px] text-zinc-500 tracking-wider group-hover:text-zinc-400 transition-colors uppercase">
                    {item.label}
                  </p>
                  <p className={`text-[10px] font-black mt-0.5 tracking-widest ${styles.text}`}>
                    &gt; {item.text}
                  </p>
                </div>

                {/* Led Indicador com Efeito Pulsante de Atividade */}
                <div className="relative flex h-2 w-2 items-center justify-center">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${styles.bg}`}></span>
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${styles.bg} ${styles.glow}`}></span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé Técnico */}
      <div className="text-[8px] font-mono text-zinc-600 mt-3 tracking-widest uppercase flex justify-between select-none">
        <span>SECURITY_DAEMON_V36</span>
        <span>STREAM_OK</span>
      </div>

    </div>
  );
}