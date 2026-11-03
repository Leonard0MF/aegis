"use client";

import type { RefObject } from "react";
import type { GeoInfo, GeoLocation, ScanResult } from "@/types/scan";
import Globe, { type GlobeCamera, type MarkerKind } from "@/components/globe/Globe";
import Panel from "@/components/ui/Panel";

const KIND_META: Record<MarkerKind, { label: string; dot: string }> = {
  server: { label: "Servidor web", dot: "bg-accent" },
  mail: { label: "E-mail (MX)", dot: "bg-info" },
  origin: { label: "Origem do scan", dot: "bg-warn" },
};

export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-dim">
      {(Object.keys(KIND_META) as MarkerKind[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${KIND_META[k].dot}`} />
          {KIND_META[k].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5" title="Conexões ilustrativas entre grandes cidades; não são dados reais">
        <span className="h-px w-3 bg-bad/70" />
        Tráfego simulado
      </span>
    </div>
  );
}

function Location({ g, kind }: { g: GeoLocation; kind: MarkerKind }) {
  const place = [g.city, g.region !== g.city ? g.region : "", g.country].filter(Boolean).join(", ");
  return (
    <li className="flex items-start gap-3 py-2.5 border-b border-line/60 last:border-0">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_META[kind].dot}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-fg">{place || "Local desconhecido"}</p>
        <p className="text-xs text-dim truncate" title={g.org}>
          {g.host ? `${g.host} · ` : ""}
          {g.org || "Provedor desconhecido"}
          {g.asn ? ` · AS${g.asn}` : ""}
        </p>
      </div>
      <span className="font-mono text-[11px] text-muted text-right [overflow-wrap:anywhere] max-w-[45%]">{g.ip}</span>
    </li>
  );
}

/** chave estável de um scan (para foco/animação do globo) */
export const scanKey = (r: ScanResult) => `${r.domain}@${r.scannedAt}`;

export function ServerList({ geo }: { geo: GeoInfo }) {
  const rows: { g: GeoLocation; kind: MarkerKind }[] = [
    ...geo.servers.map((g) => ({ g, kind: "server" as const })),
    ...geo.mail.map((g) => ({ g, kind: "mail" as const })),
    ...(geo.origin ? [{ g: geo.origin, kind: "origin" as const }] : []),
  ];
  if (rows.length === 0) {
    return <p className="text-sm text-dim py-3">Não foi possível geolocalizar os servidores.</p>;
  }
  return (
    <ul>
      {rows.map(({ g, kind }) => (
        <Location key={`${kind}-${g.ip}`} g={g} kind={kind} />
      ))}
    </ul>
  );
}

interface ServerMapProps {
  data?: ScanResult;
  isLoading: boolean;
  /** elemento onde o globo fica; o modo mapa mede ele para animar a partir daqui */
  slotRef?: RefObject<HTMLDivElement | null>;
  camera?: RefObject<GlobeCamera>;
  /** esconde/pausa este globo enquanto o de tela cheia está aberto */
  globeHidden?: boolean;
}

export default function ServerMap({ data, isLoading, slotRef, camera, globeHidden = false }: ServerMapProps) {
  const geo = data?.geo;
  return (
    <Panel
      title="Infraestrutura"
      subtitle={data ? `Onde ficam os servidores de ${data.domain}` : "Localização dos servidores"}
    >
      <div ref={slotRef} className="aspect-square w-full max-w-[420px] mx-auto">
        <Globe
          geo={isLoading ? undefined : geo}
          focusKey={isLoading ? "loading" : data ? scanKey(data) : "empty"}
          camera={camera}
          paused={globeHidden}
          className={`h-full w-full ${globeHidden ? "invisible" : ""}`}
        />
      </div>
      <div className="mt-2 space-y-3">
        <Legend />
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-panel-2 animate-pulse" />
            ))}
          </div>
        ) : !data ? (
          <p className="text-sm text-dim py-3">Faça um scan para ver a localização dos servidores.</p>
        ) : !geo ? (
          <p className="text-sm text-dim py-3">Este scan é anterior ao mapa. Escaneie de novo para ver a localização.</p>
        ) : (
          <ServerList geo={geo} />
        )}
        {geo && (
          <p className="text-[11px] text-dim leading-relaxed">
            Localização aproximada por IP. Serviços com CDN/anycast podem aparecer na sede do provedor.
          </p>
        )}
      </div>
    </Panel>
  );
}
