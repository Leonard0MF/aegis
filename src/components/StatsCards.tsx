"use client";

interface StatsCardsProps {
  data?: {
    ip?: string;
    headers?: {
      csp: boolean;
      hsts: boolean;
      xFrameOptions: boolean;
    };
  };
  isLoading: boolean;
}

export default function StatsCards({ data, isLoading }: StatsCardsProps) {
  // Calcula quantos cabeçalhos de segurança reais foram validados
  const detectedHeadersCount = data?.headers
    ? Object.values(data.headers).filter(Boolean).length
    : 0;

  // Estrutura os cards dinamicamente com base no estado do sistema
  const stats = [
    {
      title: "ACTIVE_ALERTS_DAEMON",
      value: isLoading ? "SCANNING" : data ? (detectedHeadersCount < 3 ? "01" : "00") : "03",
      subtext: isLoading ? "INSPECTING..." : data ? "VULN_INDEX_EVALUATED" : "ELEVATED_ACTIVITY_WARN",
      isAlert: !isLoading && !data, // Fica vermelho no estado inicial simulado
    },
    {
      title: "MONITORED_NODES_INDEX",
      value: isLoading ? "FETCHING" : data ? "01" : "12",
      subtext: isLoading ? "RESOLVING_IP..." : data ? `IP: ${data.ip || "UNKNOWN"}` : "NET_ASSETS_ONLINE",
      isAlert: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {stats.map((item) => (
        <div
          key={item.title}
          className={`p-5 bg-zinc-950/40 border rounded-lg backdrop-blur-md relative overflow-hidden flex flex-col justify-between min-h-[120px] transition-all duration-300 ${
            item.isAlert 
              ? "border-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]" 
              : "border-zinc-800/60"
          }`}
        >
          {/* Cantoneiras HUD Estilo Terminal */}
          <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-zinc-800"></div>
          <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-zinc-800"></div>
          <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-zinc-800"></div>
          <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-zinc-800"></div>

          {/* Cabeçalho do Card */}
          <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
            <span className="font-mono text-[9px] font-black tracking-widest text-zinc-500 uppercase">
              // {item.title}
            </span>
            <span className={`w-1 h-1 rounded-full ${isLoading ? "bg-cyan-400 animate-ping" : item.isAlert ? "bg-rose-500 animate-pulse" : "bg-zinc-700"}`} />
          </div>

          {/* Valor Numérico / Status Principal */}
          <div className="my-2">
            <p className={`text-3xl font-mono font-black tracking-tight ${
              isLoading 
                ? "text-cyan-500/60 animate-pulse text-xl tracking-widest" 
                : item.isAlert 
                ? "text-rose-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.2)]" 
                : "text-zinc-100"
            }`}>
              {item.value}
            </p>
          </div>

          {/* Subtexto de Rodapé Técnico */}
          <div className="flex items-center justify-between font-mono text-[8px] text-zinc-600 uppercase tracking-wider pt-1.5 border-t border-zinc-900/40">
            <span className={item.isAlert ? "text-rose-500/70" : isLoading ? "text-cyan-500/50" : "text-zinc-500"}>
              {item.subtext}
            </span>
            <span>SYS_OK</span>
          </div>
        </div>
      ))}
    </div>
  );
}