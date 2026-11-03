"use client";

import type { ScanResult } from "@/types/scan";
import Panel from "@/components/ui/Panel";

interface DetailsProps {
  data?: ScanResult;
  isLoading: boolean;
}

type Tone = "bad" | "ok" | "warn";

const TONE_TEXT: Record<Tone, string> = { bad: "text-bad", ok: "text-ok", warn: "text-warn" };

/** Linha rótulo/valor: empilha no mobile, duas colunas a partir de sm. Valores longos quebram sem estourar. */
function Row({ label, children, tone }: { label: string; children: React.ReactNode; tone?: Tone }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr] gap-x-4 gap-y-0.5 py-2.5 border-b border-line/60 last:border-0">
      <dt className="text-xs text-dim">{label}</dt>
      <dd className={`font-mono text-xs leading-5 [overflow-wrap:anywhere] ${tone ? TONE_TEXT[tone] : "text-muted"}`}>
        {children}
      </dd>
    </div>
  );
}

function Chips({ items, max = 6 }: { items: string[]; max?: number }) {
  if (items.length === 0) return <>—</>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.slice(0, max).map((v) => (
        <span key={v} className="rounded-md bg-panel-2 px-1.5 py-0.5 ring-1 ring-inset ring-line">
          {v}
        </span>
      ))}
      {items.length > max && <span className="px-1 py-0.5 text-dim">+{items.length - max}</span>}
    </span>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2.5 pt-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-5 rounded bg-panel-2 animate-pulse" />
      ))}
    </div>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

export function TlsDetails({ data, isLoading }: DetailsProps) {
  const tls = data?.tls;
  return (
    <Panel title="Certificado TLS" subtitle={tls ? `Emitido por ${tls.issuer}` : undefined}>
      {isLoading ? (
        <Skeleton rows={5} />
      ) : !data ? (
        <p className="text-sm text-dim py-4">Sem dados.</p>
      ) : !tls ? (
        <p className="text-sm text-bad py-4">HTTPS indisponível neste host.</p>
      ) : (
        <dl>
          <Row label="Status" tone={tls.valid ? "ok" : "bad"}>
            {tls.valid ? "Válido" : tls.error ?? "Inválido"}
          </Row>
          <Row label="Validade" tone={tls.daysRemaining < 0 ? "bad" : tls.daysRemaining < 30 ? "warn" : undefined}>
            {fmtDate(tls.validFrom)} → {fmtDate(tls.validTo)}
            <span className="text-dim">
              {" "}
              ({tls.daysRemaining < 0 ? `expirou há ${-tls.daysRemaining} dias` : `${tls.daysRemaining} dias restantes`})
            </span>
          </Row>
          <Row label="Protocolo">{tls.protocol}</Row>
          <Row label="Nomes (SAN)">
            <Chips items={tls.altNames} />
          </Row>
        </dl>
      )}
    </Panel>
  );
}

export function DnsDetails({ data, isLoading }: DetailsProps) {
  return (
    <Panel title="DNS e roteamento">
      {isLoading ? (
        <Skeleton rows={5} />
      ) : !data ? (
        <p className="text-sm text-dim py-4">Sem dados.</p>
      ) : (
        <dl>
          <Row label="IPs">
            <Chips items={data.ips} max={4} />
          </Row>
          <Row label="SPF" tone={data.dns.spf ? undefined : "bad"}>
            {data.dns.spf ?? "Ausente"}
          </Row>
          <Row label="DMARC" tone={data.dns.dmarc ? undefined : "bad"}>
            {data.dns.dmarc ?? "Ausente"}
          </Row>
          <Row label="MX">
            <Chips items={data.dns.mx} max={3} />
          </Row>
          <Row label="URL final">{data.finalUrl}</Row>
          {data.redirects.length > 0 && (
            <Row label="Redirects">{data.redirects.join(" → ")}</Row>
          )}
        </dl>
      )}
    </Panel>
  );
}
