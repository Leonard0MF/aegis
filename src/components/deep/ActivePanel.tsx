"use client";

import { useState } from "react";
import { Check, Copy, Lock, ShieldCheck } from "lucide-react";
import type { ActiveInfo, ScanResult, SecurityCheck } from "@/types/scan";
import Panel from "@/components/ui/Panel";
import { scanActive, verifyDomain, type VerifyStatus } from "@/lib/services/scanner";
import { SeverityBadge } from "./Severity";

interface Props {
  data?: ScanResult;
  onResult: (active: ActiveInfo, checks: SecurityCheck[]) => void;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-[11px] text-dim mb-1">{label}</p>
      <div className="flex items-center gap-1.5 rounded-lg bg-canvas/60 ring-1 ring-inset ring-line pl-2.5 pr-1 py-1">
        <code className="flex-1 min-w-0 font-mono text-xs text-fg [overflow-wrap:anywhere]">{value}</code>
        <button
          type="button"
          aria-label={`Copiar ${label}`}
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-md p-1.5 text-dim hover:text-fg hover:bg-panel-2"
        >
          {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}

export default function ActivePanel({ data, onResult }: Props) {
  const [verify, setVerify] = useState<VerifyStatus | null>(null);
  const [busy, setBusy] = useState<"verify" | "scan" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"dns" | "file">("dns");
  const a = data?.active;
  const domain = data?.domain;

  async function check() {
    if (!domain) return;
    setBusy("verify");
    setError(null);
    try {
      setVerify(await verifyDomain(domain));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na verificação");
    } finally {
      setBusy(null);
    }
  }

  async function run() {
    if (!domain) return;
    setBusy("scan");
    setError(null);
    try {
      const r = await scanActive(domain);
      onResult(r.active, r.checks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha nos testes ativos");
      void check(); // mostra de novo as instruções, se a verificação expirou
    } finally {
      setBusy(null);
    }
  }

  const verified = verify?.verified && verify.domain === domain;

  return (
    <Panel
      title="Testes ativos"
      subtitle="Portas expostas e arquivos sensíveis · só para domínios verificados"
      actions={verified || a ? <ShieldCheck size={16} className="text-ok" /> : <Lock size={15} className="text-dim" />}
    >
      {!data ? (
        <p className="text-sm text-dim py-2">Sem dados.</p>
      ) : (
        <div className="space-y-3">
          {a && (
            <div className="space-y-2.5">
              <p className="text-xs text-dim">
                {new Date(a.scannedAt).toLocaleString("pt-BR")} · {a.portsTested} portas e {a.pathsTested} caminhos testados
              </p>
              {a.exposed.length === 0 && a.ports.filter((p) => p.risk !== "info" && p.risk !== "low").length === 0 ? (
                <p className="text-sm text-ok">Nada sensível exposto.</p>
              ) : (
                <ul className="divide-y divide-line/60 rounded-xl ring-1 ring-inset ring-line overflow-hidden">
                  {a.exposed.map((e) => (
                    <li key={e.path} className="flex items-start gap-2 px-3 py-2 bg-panel-2/40">
                      <SeverityBadge severity={e.severity} />
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-fg">{e.path}</p>
                        <p className="text-[11px] text-muted">{e.label}</p>
                      </div>
                    </li>
                  ))}
                  {a.ports.map((p) => (
                    <li key={p.port} className="flex items-center gap-2 px-3 py-2 bg-panel-2/40">
                      <SeverityBadge severity={p.risk} />
                      <p className="text-xs text-fg">
                        <span className="font-mono">{p.port}/tcp</span> <span className="text-muted">{p.service}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!verified ? (
            <>
              {!a && (
                <p className="text-sm text-muted leading-relaxed">
                  Varrer portas e procurar arquivos como <code className="font-mono text-xs text-fg">.env</code> e{" "}
                  <code className="font-mono text-xs text-fg">.git</code> em sites de terceiros sem autorização é ilegal
                  (Lei 12.737/2012). Prove que <span className="text-fg">{domain}</span> é seu para liberar.
                </p>
              )}
              {!verify ? (
                <button
                  type="button"
                  onClick={check}
                  disabled={busy !== null}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm text-fg hover:border-accent/50 disabled:opacity-50"
                >
                  {busy === "verify" ? "Gerando…" : a ? "Rodar de novo" : "Verificar propriedade"}
                </button>
              ) : (
                <div className="space-y-3 rounded-xl bg-panel-2/50 ring-1 ring-inset ring-line p-3">
                  <div className="flex gap-1 text-xs" role="tablist">
                    {(["dns", "file"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="tab"
                        aria-selected={method === m}
                        onClick={() => setMethod(m)}
                        className={`rounded-md px-2.5 py-1 ${method === m ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"}`}
                      >
                        {m === "dns" ? "Registro DNS" : "Arquivo no site"}
                      </button>
                    ))}
                  </div>
                  {method === "dns" ? (
                    <>
                      <p className="text-xs text-muted">
                        Crie um registro <span className="text-fg">TXT</span> no seu provedor de DNS. Verificar o domínio
                        raiz também libera os subdomínios.
                      </p>
                      <CopyField label="Nome" value={verify.dns.name} />
                      <CopyField label="Valor" value={verify.dns.value} />
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted">Publique um arquivo de texto com este conteúdo:</p>
                      <CopyField label="URL" value={verify.file.url} />
                      <CopyField label="Conteúdo" value={verify.file.content} />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={check}
                    disabled={busy !== null}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-canvas hover:brightness-110 disabled:opacity-50"
                  >
                    {busy === "verify" ? "Verificando…" : "Verificar agora"}
                  </button>
                  <p className="text-[11px] text-dim">
                    {verify.verified ? "" : "Ainda não encontrado. A propagação do DNS pode levar alguns minutos."}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-ok">
                Propriedade confirmada via {verify.method === "dns" ? "DNS" : "arquivo"}
                {verify.via !== domain && ` (${verify.via})`}.
              </p>
              <button
                type="button"
                onClick={run}
                disabled={busy !== null}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-canvas hover:brightness-110 disabled:opacity-50"
              >
                {busy === "scan" ? "Testando… (até 1 min)" : a ? "Rodar testes de novo" : "Executar testes ativos"}
              </button>
            </div>
          )}
          {error && <p role="alert" className="text-xs text-bad">{error}</p>}
        </div>
      )}
    </Panel>
  );
}
