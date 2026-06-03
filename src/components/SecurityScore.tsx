"use client";

interface SecurityScoreProps {
  score?: number;
  isLoading: boolean;
}

export default function SecurityScore({ score, isLoading }: SecurityScoreProps) {
  // Pontuação padrão caso venha indefinido fora do loading
  const activeScore = score ?? 87;
  
  const isExcellent = activeScore >= 80;
  const isModerate = activeScore >= 50;

  const label = isExcellent
    ? "EXCELLENT_SECURITY_POSTURE"
    : isModerate
    ? "MODERATE_SECURITY_POSTURE"
    : "WEAK_SECURITY_POSTURE";

  // Gerenciamento de cores dinâmicas com base na severidade (Neon Matrix / Cybersec)
  const statusColor = isExcellent
    ? "text-emerald-400 border-emerald-500/30 shadow-emerald-500/10"
    : isModerate
    ? "text-amber-400 border-amber-500/30 shadow-amber-500/10"
    : "text-rose-500 border-rose-500/30 shadow-rose-500/10";

  const ringColor = isExcellent
    ? "border-emerald-500"
    : isModerate
    ? "border-amber-400"
    : "border-rose-500";

  return (
    <div className={`p-6 bg-zinc-950/40 border border-zinc-800/60 rounded-lg backdrop-blur-md relative overflow-hidden flex items-center justify-between min-h-[190px] transition-all duration-500 ${!isLoading && score ? `shadow-[0_0_25px_rgba(0,0,0,0.5)]` : ""}`}>
      
      {/* Cantoneiras HUD Estilo Mira Militar */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-800"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-zinc-800"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-zinc-800"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-800"></div>

      {isLoading ? (
        /* ================= ESTADO CARREGANDO ================= */
        <div className="flex-1 flex items-center justify-between animate-pulse">
          <div className="space-y-3 font-mono">
            <h3 className="text-[10px] font-black tracking-widest text-zinc-600 uppercase">// CALC_INTELLIGENCE_METRIC</h3>
            <div className="text-2xl font-black text-cyan-500/60 tracking-tighter">COMPUTING_IDX...</div>
            <div className="text-[9px] text-zinc-500 tracking-wider">RUNNING WEIGHT MATRIX V.16</div>
          </div>
          
          {/* Anel de radar rotacionando em loading */}
          <div className="h-28 w-28 rounded-full border-2 border-dashed border-cyan-500/30 animate-[spin_10s_infinite_linear] flex items-center justify-center">
            <div className="h-20 w-20 rounded-full border border-zinc-800 flex items-center justify-center">
              <span className="text-[9px] font-mono text-cyan-400/50 uppercase tracking-widest">CALC</span>
            </div>
          </div>
        </div>
      ) : (
        /* ================= ESTADO COMPLETO / DADOS ATIVOS ================= */
        <>
          <div className="font-mono flex flex-col justify-between h-full py-1">
            <div>
              <h3 className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">
                // SECURITY_INTEGRITY_SCORE
              </h3>
              <p className="text-5xl font-black tracking-tighter text-zinc-100 mt-2">
                {activeScore}
                <span className="text-zinc-700 text-xs tracking-widest font-normal ml-1">_PTS</span>
              </p>
            </div>

            <p className={`text-[10px] font-bold tracking-wider uppercase mt-4 flex items-center gap-1.5 ${statusColor.split(" ")[0]}`}>
              <span className="inline-block w-1.5 h-1.5 bg-current rounded-full animate-pulse"></span>
              {label}
            </p>
          </div>

          {/* Gráfico do Anel Holográfico de Proteção */}
          <div className={`h-28 w-28 rounded-full border-[6px] border-zinc-900 ${ringColor} flex items-center justify-center relative shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] group transition-all duration-500`}>
            
            {/* Linha externa cirúrgica fina decorativa */}
            <div className="absolute -inset-[10px] rounded-full border border-zinc-800/40 border-dashed scale-95 group-hover:scale-100 transition-transform duration-700"></div>

            <div className="text-center font-mono">
              <span className="text-xl font-black tracking-tighter text-zinc-100 block">
                {activeScore}%
              </span>
              <span className="text-[8px] text-zinc-600 tracking-widest uppercase block -mt-0.5">
                RATING
              </span>
            </div>
          </div>
        </>
      )}

    </div>
  );
}