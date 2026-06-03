"use client";

import { useEffect, useState } from "react";

type ThreatLevel = "info" | "warning" | "critical" | "success";

type ThreatEvent = {
  id?: string; // ID opcional para evitar colisão de chaves
  type: ThreatLevel;
  message: string;
  time: string;
  color?: string; // Suporte a cor dinâmica vinda do laser do globo
};

interface ThreatFeedProps {
  isLoading: boolean;
}

const levelStyle = (type: ThreatLevel) => {
  switch (type) {
    case "info":
      return {
        text: "text-cyan-400/90",
        bg: "bg-cyan-400",
        glow: "shadow-[0_0_8px_rgba(34,211,238,0.4)]",
        border: "border-cyan-500/10"
      };
    case "warning":
      return {
        text: "text-amber-400/90",
        bg: "bg-amber-400",
        glow: "shadow-[0_0_8px_rgba(251,191,36,0.4)]",
        border: "border-amber-500/10"
      };
    case "critical":
      return {
        text: "text-rose-500 font-bold",
        bg: "bg-rose-500",
        glow: "shadow-[0_0_12px_rgba(244,63,94,0.6)] animate-pulse", // Trocado ping interno para evitar sobrepor o indicador global
        border: "border-rose-500/20 bg-rose-500/[0.02]"
      };
    case "success":
      return {
        text: "text-emerald-400/90",
        bg: "bg-emerald-400",
        glow: "shadow-[0_0_8px_rgba(52,211,153,0.4)]",
        border: "border-emerald-500/10"
      };
  }
};

const initialFeed: ThreatEvent[] = [
  { type: "critical", message: "OPEN_SSH_PORT_DETECTED // PORT_22", time: "16:31:42" },
  { type: "warning", message: "MISSING_CSP_SECURITY_HEADER", time: "16:30:15" },
  { type: "success", message: "SSL_CERTIFICATE_VALID_TLS_1.3", time: "16:28:59" },
  { type: "warning", message: "OUTDATED_TLS_CONFIGURATION_V1.1", time: "16:25:04" },
  { type: "info", message: "TARGET_ASSET_RECON_COMPLETED", time: "16:22:11" },
];

// Mapeia as cores randômicas do globo de volta para os níveis do seu HUD
const mapColorToLevel = (color: string): ThreatLevel => {
  if (color === "#FF0055") return "critical";
  if (color === "#FFB800") return "warning";
  if (color === "#00FF66") return "success";
  return "info";
};

export default function ThreatFeed({ isLoading }: ThreatFeedProps) {
  const [feed, setFeed] = useState<ThreatEvent[]>(initialFeed);

  useEffect(() => {
    const handleNewAttack = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];
      const threatType = mapColorToLevel(detail.color);

      // Constrói a mensagem militarizada baseada nos vetores cruzando o planeta
      const message = `INTERCEPT_PACKET // ORIGIN: ${detail.origin.toUpperCase()} -> TARGET: ${detail.target.toUpperCase()}`;

      const newEvent: ThreatEvent = {
        id: Math.random().toString(),
        type: threatType,
        message,
        time: timeStr,
      };

      // Insere o novo log no topo e trunca a lista em 20 itens para não estourar a memória
      setFeed(prev => [newEvent, ...prev].slice(0, 20));
    };

    window.addEventListener("aegis_attack", handleNewAttack);
    return () => window.removeEventListener("aegis_attack", handleNewAttack);
  }, []);

  return (
    <div className="p-6 bg-zinc-950/40 border border-zinc-800/60 rounded-lg backdrop-blur-md relative overflow-hidden h-full flex flex-col justify-between min-h-[440px]">
      
      {/* Cantoneiras HUD Industriais */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-800"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-zinc-800"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-zinc-800"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-800"></div>

      {/* Header do Feed */}
      <div className="border-b border-zinc-900 pb-2 mb-4 flex items-center justify-between">
        <h3 className="text-[10px] font-mono font-black tracking-widest text-zinc-500 uppercase">
          // LIVE_THREAT_FEED
        </h3>
        <span className="flex h-1.5 w-1.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
      </div>

      {/* Área dos Logs */}
      <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[340px] pr-1 custom-scrollbar">
        {isLoading ? (
          /* Estado Carregando: Logs falsos correndo na tela tipo buffer */
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="font-mono text-[10px] text-zinc-700 animate-pulse uppercase tracking-wider">
              &gt; [00:00:00] BUFFERING_STREAM_NODE_{i}...
            </div>
          ))
        ) : (
          /* Estado Ativo: Eventos de Segurança Estilizados e Dinâmicos */
          feed.map((event, index) => {
            const style = levelStyle(event.type);

            return (
              <div
                key={event.id || index}
                className={`p-2.5 border rounded font-mono text-[10px] tracking-wide flex items-start gap-2.5 transition-all duration-300 hover:bg-zinc-900/20 animate-fadeIn ${style.border}`}
              >
                {/* Led Indicador */}
                <div className="relative flex h-1.5 w-1.5 items-center justify-center mt-1 select-none">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-70 ${style.bg} ${style.glow}`}></span>
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${style.bg}`}></span>
                </div>

                {/* Mensagem de Terminal */}
                <div className="flex-1">
                  <span className="text-zinc-600 mr-1.5 select-none">[{event.time}]</span>
                  <span className={style.text}>
                    {event.message}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé do Feed */}
      <div className="text-[8px] font-mono text-zinc-600 mt-4 tracking-widest uppercase border-t border-zinc-900/60 pt-2 flex justify-between select-none">
        <span>FEED_SOURCE: SHODAN_NODE_MATRIX</span>
        <span>REC_COUNT: {feed.length.toString().padStart(2, "0")}</span>
      </div>

    </div>
  );
}