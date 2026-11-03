"use client";

import type { ScanResult } from "@/types/scan";
import Panel from "@/components/ui/Panel";

interface ScanDetailsProps {
  data?: ScanResult;
  isLoading: boolean;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "bad" | "ok" }) {
  return (
    <div className="flex justify-between gap-6 py-2 border-b border-line/60 last:border-0 text-[13px]">
      <dt className="text-dim shrink-0">{label}</dt>
      <dd
        className={`text-right font-mono text-xs leading-5 break-all ${
          tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "text-muted"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

export default function ScanDetails({ data, isLoading }: ScanDetailsProps) {
  if (isLoading || !data) return null;
  const { tls, dns } = data;
  const san =
    tls && tls.altNames.slice(0, 4).join(", ") + (tls.altNames.length > 4 ? ` +${tls.altNames.length - 4}` : "");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Panel title="Certificado TLS">
        {tls ? (
          <dl>
            <Row label="Status" value={tls.valid ? "Válido" : tls.error ?? "Inválido"} tone={tls.valid ? "ok" : "bad"} />
            <Row label="Emissor" value={tls.issuer} />
            <Row label="Válido desde" value={fmtDate(tls.validFrom)} />
            <Row label="Expira em" value={fmtDate(tls.validTo)} tone={tls.daysRemaining < 30 ? "bad" : undefined} />
            <Row label="Protocolo" value={tls.protocol} />
            <Row label="Nomes (SAN)" value={san || "—"} />
          </dl>
        ) : (
          <p className="text-sm text-bad">HTTPS indisponível neste host.</p>
        )}
      </Panel>

      <Panel title="DNS e roteamento">
        <dl>
          <Row label="IPs" value={data.ips.slice(0, 3).join(", ") + (data.ips.length > 3 ? " …" : "")} />
          <Row label="SPF" value={dns.spf ?? "Ausente"} tone={dns.spf ? undefined : "bad"} />
          <Row label="DMARC" value={dns.dmarc ?? "Ausente"} tone={dns.dmarc ? undefined : "bad"} />
          <Row label="MX" value={dns.mx.length ? dns.mx.slice(0, 3).join(", ") : "Nenhum"} />
          <Row label="URL final" value={data.finalUrl} />
          {data.redirects.length > 0 && <Row label="Redirects" value={data.redirects.join(" → ")} />}
        </dl>
      </Panel>
    </div>
  );
}
