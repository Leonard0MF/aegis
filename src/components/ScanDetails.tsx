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
export function Row({ label, children, tone }: { label: string; children: React.ReactNode; tone?: Tone }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr] gap-x-4 gap-y-0.5 py-2.5 border-b border-line/60 last:border-0">
      <dt className="text-xs text-dim">{label}</dt>
      <dd className={`font-mono text-xs leading-5 [overflow-wrap:anywhere] ${tone ? TONE_TEXT[tone] : "text-muted"}`}>
        {children}
      </dd>
    </div>
  );
}

export function Chips({ items, max = 6 }: { items: string[]; max?: number }) {
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

export function Skeleton({ rows }: { rows: number }) {
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
          <Row label="Protocolo">
            {tls.protocol}
            {tls.cipher && <span className="text-dim"> · {tls.cipher}</span>}
          </Row>
          {tls.versions && (
            <Row label="Versões aceitas">
              <span className="flex flex-wrap gap-1">
                {tls.versions.map((v) => {
                  const legacy = v.version === "TLSv1" || v.version === "TLSv1.1";
                  const name = v.version === "TLSv1" ? "1.0" : v.version.replace("TLSv", "");
                  const cls = !v.supported
                    ? "text-dim line-through decoration-dim/60"
                    : legacy
                      ? "text-bad ring-bad/30 bg-bad/10"
                      : "text-ok ring-ok/25 bg-ok/10";
                  return (
                    <span
                      key={v.version}
                      title={v.supported ? `Aceita${v.cipher ? ` (${v.cipher})` : ""}` : "Recusada"}
                      className={`rounded-md px-1.5 py-0.5 ring-1 ring-inset ring-line ${cls}`}
                    >
                      TLS {name}
                    </span>
                  );
                })}
              </span>
            </Row>
          )}
          {tls.keyType && (
            <Row
              label="Chave"
              tone={(tls.keyType === "RSA" && (tls.keyBits ?? 0) < 2048) || /sha1|md5/i.test(tls.signatureAlgorithm ?? "") ? "bad" : undefined}
            >
              {tls.keyType} {tls.keyBits} bits
              {tls.signatureAlgorithm && <span className="text-dim"> · {tls.signatureAlgorithm}</span>}
            </Row>
          )}
          {tls.chain && tls.chain.length > 0 && (
            <Row label="Cadeia">
              {tls.chain.join(" ← ")}
              {tls.ocspStapled && <span className="text-ok"> · OCSP stapling</span>}
            </Row>
          )}
          <Row label="Nomes (SAN)">
            <Chips items={tls.altNames} />
          </Row>
        </dl>
      )}
    </Panel>
  );
}

export function DnsDetails({ data, isLoading }: DetailsProps) {
  const e = data?.email;
  return (
    <Panel title="DNS e e-mail" subtitle="Proteção contra falsificação de e-mail">
      {isLoading ? (
        <Skeleton rows={5} />
      ) : !data ? (
        <p className="text-sm text-dim py-4">Sem dados.</p>
      ) : (
        <dl>
          <Row label="IPs">
            <Chips items={data.ips} max={4} />
          </Row>
          {e ? (
            <>
              <Row
                label="SPF"
                tone={!e.spf.record || e.spf.all === "+all" || e.spf.lookups > 10 ? "bad" : e.spf.all === "?all" || !e.spf.all ? "warn" : undefined}
              >
                {e.spf.record ? (
                  <>
                    {e.spf.all ?? "sem all"} <span className="text-dim">· {e.spf.lookups}/10 consultas</span>
                    {e.spf.includes.length > 0 && <span className="text-dim"> · {e.spf.includes.slice(0, 3).join(", ")}</span>}
                  </>
                ) : (
                  "Ausente"
                )}
              </Row>
              <Row
                label="DMARC"
                tone={!e.dmarc.record ? "bad" : e.dmarc.policy === "none" || e.dmarc.pct < 100 ? "warn" : "ok"}
              >
                {e.dmarc.record ? (
                  <>
                    p={e.dmarc.policy}
                    {e.dmarc.subdomainPolicy && ` · sp=${e.dmarc.subdomainPolicy}`}
                    {e.dmarc.pct < 100 && ` · pct=${e.dmarc.pct}`}
                    <span className="text-dim">{e.dmarc.reporting ? " · relatórios ativos" : " · sem relatórios"}</span>
                  </>
                ) : (
                  "Ausente"
                )}
              </Row>
              <Row label="DKIM">{e.dkim.length ? <Chips items={e.dkim} max={4} /> : <span className="text-dim">não encontrado nos seletores comuns</span>}</Row>
              {data.dns.mx.length > 0 && (
                <Row label="MTA-STS" tone={e.mtaSts.mode === "enforce" ? "ok" : "warn"}>
                  {e.mtaSts.record ? `modo ${e.mtaSts.mode ?? "?"}` : "Ausente"}
                  <span className="text-dim">{e.tlsRpt ? " · TLS-RPT ativo" : ""}</span>
                </Row>
              )}
              <Row label="DNSSEC" tone={e.dnssec ? "ok" : e.dnssec === false ? "warn" : undefined}>
                {e.dnssec === null ? "Não verificado" : e.dnssec ? "Assinado e validado" : "Ausente"}
              </Row>
            </>
          ) : (
            <>
              <Row label="SPF" tone={data.dns.spf ? undefined : "bad"}>
                {data.dns.spf ?? "Ausente"}
              </Row>
              <Row label="DMARC" tone={data.dns.dmarc ? undefined : "bad"}>
                {data.dns.dmarc ?? "Ausente"}
              </Row>
            </>
          )}
          <Row label="MX">
            <Chips items={data.dns.mx} max={3} />
          </Row>
          <Row label="URL final">{data.finalUrl}</Row>
          {data.redirects.length > 0 && <Row label="Redirects">{data.redirects.join(" → ")}</Row>}
        </dl>
      )}
    </Panel>
  );
}
