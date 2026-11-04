"use client";

import { useRef, useState } from "react";
import { Download, RotateCcw, Trash2, Upload } from "lucide-react";
import Panel from "@/components/ui/Panel";
import { normalizeDomain } from "@/lib/domainName";
import { clearHistory, importHistory, readRaw } from "@/lib/storage/scanHistory";
import { useScanHistory } from "@/lib/storage/useScanHistory";
import { resetSettings, updateSettings, useSettings } from "@/lib/storage/settings";

const BTN =
  "inline-flex items-center gap-2 rounded-xl border border-line bg-panel-2/60 px-3 py-2 text-sm text-muted hover:text-fg hover:border-line-strong transition-colors disabled:opacity-40";

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        <span className="block text-xs text-dim mt-0.5">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${
          checked ? "bg-accent" : "bg-line-strong"
        }`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-fg transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </label>
  );
}

function Preferences() {
  const s = useSettings();
  const [target, setTarget] = useState(s.defaultTarget);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const saveTarget = () => {
    const v = target.trim();
    if (v && !normalizeDomain(v)) return setMsg({ text: "Domínio inválido", ok: false });
    const d = v ? normalizeDomain(v)! : "";
    updateSettings({ defaultTarget: d });
    setTarget(d);
    setMsg({ text: "Salvo", ok: true });
  };

  return (
    <Panel title="Preferências" subtitle="Salvas só neste navegador">
      <div className="divide-y divide-line/70">
        <div className="py-3">
          <label htmlFor="default-target" className="block text-sm text-fg">Alvo do auto-diagnóstico</label>
          <p className="text-xs text-dim mt-0.5">
            Escaneado ao abrir o AEGIS sem histórico, quando ele roda em localhost ou IP. Publicado num domínio, ele se autoescaneia.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              id="default-target"
              value={target}
              onChange={(e) => { setTarget(e.target.value); setMsg(null); }}
              onKeyDown={(e) => e.key === "Enter" && saveTarget()}
              placeholder="github.com (padrão)"
              className="min-w-0 flex-1 rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm text-fg outline-none placeholder:text-dim focus:border-accent/50"
            />
            <button type="button" onClick={saveTarget} className={BTN}>Salvar</button>
          </div>
          {msg && <p role="status" className={`mt-1.5 text-xs ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
        </div>
        <Toggle
          label="Mapear subdomínios automaticamente"
          hint="Depois de cada scan, busca subdomínios e riscos de takeover. Desligado, roda só quando você pedir."
          checked={s.autoSurface}
          onChange={(v) => updateSettings({ autoSurface: v })}
        />
        <Toggle
          label="Mostrar só problemas em Verificações"
          hint="A lista da Visão geral já abre filtrada em falhas e atenções."
          checked={s.issuesOnlyByDefault}
          onChange={(v) => updateSettings({ issuesOnlyByDefault: v })}
        />
        <div className="pt-3">
          <button type="button" onClick={() => { resetSettings(); setTarget(""); setMsg(null); }} className={BTN}>
            <RotateCcw size={15} /> Restaurar padrões
          </button>
        </div>
      </div>
    </Panel>
  );
}

function HistoryData() {
  const history = useScanHistory();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const bytes = new Blob([readRaw()]).size;
  const domains = new Set(history.map((r) => r.domain)).size;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: "aegis", version: 1, exportedAt: new Date().toISOString(), scans: history }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegis-historico-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("Arquivo grande demais (máx. 5 MB)");
      const { added, invalid } = importHistory(await file.text());
      setMsg({ text: `${added} ${added === 1 ? "scan importado" : "scans importados"}${invalid ? ` · ${invalid} inválido(s) ignorado(s)` : ""}`, ok: true });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Falha ao importar", ok: false });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Panel title="Histórico de scans" subtitle="Guardado no localStorage deste navegador; nada vai para o servidor">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: history.length, l: history.length === 1 ? "scan" : "scans" },
          { v: domains, l: domains === 1 ? "domínio" : "domínios" },
          { v: bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`, l: "usados" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-line/70 bg-canvas/40 px-2 py-2.5">
            <p className="font-mono text-xl tabular-nums text-fg">{s.v}</p>
            <p className="text-[11px] text-dim">{s.l}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-dim">Até 10 scans por domínio e 200 no total; os mais antigos saem primeiro.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={exportJson} disabled={!history.length} className={BTN}>
          <Download size={15} /> Exportar JSON
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={BTN}>
          <Upload size={15} /> Importar JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {confirm ? (
          <span className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => { clearHistory(); setConfirm(false); setMsg({ text: "Histórico apagado", ok: true }); }}
              className="inline-flex items-center gap-2 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad hover:bg-bad/20"
            >
              <Trash2 size={15} /> Confirmar: apagar {history.length}
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="text-sm text-dim hover:text-fg">Cancelar</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} disabled={!history.length} className={`${BTN} hover:text-bad`}>
            <Trash2 size={15} /> Apagar histórico
          </button>
        )}
      </div>
      {msg && <p role="status" className={`mt-2 text-xs ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
    </Panel>
  );
}

function About() {
  return (
    <Panel title="Sobre o AEGIS" subtitle="Como os scans funcionam">
      <ul className="space-y-3 text-sm text-muted">
        <li>
          <span className="text-fg">Passivo por padrão.</span> TLS, headers, DNS, e-mail, CVEs das tecnologias detectadas,
          reputação e subdomínios usam só informação pública, a mesma que qualquer navegador ou consulta DNS obtém.
        </li>
        <li>
          <span className="text-fg">Testes ativos só com prova de propriedade.</span> Portas abertas e arquivos sensíveis expostos
          só são testados depois que você publica um registro TXT ou um arquivo no domínio (Lei 12.737/2012).
        </li>
        <li>
          <span className="text-fg">Sem conta.</span> O histórico fica no seu navegador. Use Exportar para levar para outro computador.
        </li>
      </ul>
    </Panel>
  );
}

export default function SettingsView() {
  return (
    <main className="px-4 py-5 md:px-8 md:py-6 space-y-4">
      <header className="mb-2">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Configurações</h1>
        <p className="text-sm text-muted mt-0.5">Preferências do scanner e dados salvos neste navegador</p>
      </header>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <Preferences />
        <div className="space-y-4">
          <HistoryData />
          <About />
        </div>
      </div>
    </main>
  );
}
