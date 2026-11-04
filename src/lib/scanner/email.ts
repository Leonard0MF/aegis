import dns from "node:dns/promises";
import type { DnsInfo, EmailInfo, SecurityCheck } from "@/types/scan";
import { check } from "./checks";
import { request } from "./http";

/** Seletores DKIM mais comuns (Google, Microsoft 365, Mailchimp, SES, Zoho…). */
const DKIM_SELECTORS = [
  "google", "selector1", "selector2", "default", "k1", "k2", "s1", "s2",
  "dkim", "mail", "smtp", "mandrill", "zoho", "protonmail", "fm1", "amazonses",
];

const txt = (name: string) =>
  dns.resolveTxt(name).then(
    (r) => r.map((chunks) => chunks.join("")),
    () => [] as string[],
  );

/** Conta lookups DNS do SPF (limite da RFC 7208: 10), seguindo include/redirect. */
async function spfLookups(record: string, depth = 0, seen = new Set<string>()): Promise<number> {
  if (depth > 5) return 0;
  const terms = record.split(/\s+/).slice(1);
  let count = 0;
  const nested: string[] = [];
  for (const t of terms) {
    const term = t.replace(/^[+~?-]/, "").toLowerCase();
    if (/^(a|mx|ptr)([:/]|$)/.test(term) || term.startsWith("exists:")) count++;
    const inc = /^include:(.+)$/.exec(term)?.[1] ?? /^redirect=(.+)$/.exec(term)?.[1];
    if (inc) {
      count++;
      if (!seen.has(inc)) {
        seen.add(inc);
        nested.push(inc);
      }
    }
  }
  const sub = await Promise.all(
    nested.map(async (name) => {
      const rec = (await txt(name)).find((r) => /^v=spf1\b/i.test(r));
      return rec ? spfLookups(rec, depth + 1, seen) : 0;
    }),
  );
  return count + sub.reduce((a, b) => a + b, 0);
}

/** DNSSEC via DNS-over-HTTPS: o resolvedor valida e devolve o bit AD. */
async function dnssec(domain: string): Promise<boolean | null> {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=SOA&do=1`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/dns-json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { AD?: boolean; Status?: number };
    return j.Status === 0 ? !!j.AD : null;
  } catch {
    return null;
  }
}

async function mtaSts(domain: string): Promise<EmailInfo["mtaSts"]> {
  const rec = (await txt(`_mta-sts.${domain}`)).some((r) => /^v=STSv1/i.test(r));
  if (!rec) return { record: false, mode: null };
  const res = await request(new URL(`https://mta-sts.${domain}/.well-known/mta-sts.txt`), {
    maxBody: 4096,
    timeoutMs: 5000,
  });
  const mode = res?.status === 200 ? /^mode:\s*(\w+)/im.exec(res.body)?.[1]?.toLowerCase() ?? null : null;
  return { record: true, mode };
}

export async function inspectEmail(domain: string, base: DnsInfo): Promise<EmailInfo> {
  const spfRecord = base.spf;
  const allTerm = (spfRecord ?? "").split(/\s+/).find((t) => /^[+~?-]?all$/i.test(t));
  const dm = base.dmarc ?? "";
  const tag = (k: string) => new RegExp(`(?:^|;)\\s*${k}\\s*=\\s*([^;\\s]+)`, "i").exec(dm)?.[1]?.toLowerCase() ?? null;

  const [lookups, dkim, sts, rpt, sec] = await Promise.all([
    spfRecord ? spfLookups(spfRecord) : Promise.resolve(0),
    Promise.all(
      DKIM_SELECTORS.map(async (s) => ((await txt(`${s}._domainkey.${domain}`)).some((r) => /p=/i.test(r)) ? s : null)),
    ).then((l) => l.filter((s): s is string => !!s)),
    mtaSts(domain),
    txt(`_smtp._tls.${domain}`).then((l) => l.some((r) => /^v=TLSRPTv1/i.test(r))),
    dnssec(domain),
  ]);

  return {
    spf: {
      record: spfRecord,
      all: allTerm ? ((allTerm.length === 3 ? "+all" : allTerm.toLowerCase()) as EmailInfo["spf"]["all"]) : null,
      lookups,
      includes: [...(spfRecord ?? "").matchAll(/include:(\S+)/gi)].map((m) => m[1]).slice(0, 10),
    },
    dmarc: {
      record: base.dmarc,
      policy: base.dmarc ? tag("p") : null,
      subdomainPolicy: base.dmarc ? tag("sp") : null,
      pct: Number(tag("pct") ?? 100),
      reporting: !!tag("rua"),
      inheritedFrom: base.dmarcFrom,
    },
    dkim,
    mtaSts: sts,
    tlsRpt: rpt,
    dnssec: sec,
    platform: base.platform ?? null,
  };
}

export function emailChecks(e: EmailInfo, hasMx: boolean): SecurityCheck[] {
  const out: SecurityCheck[] = [];
  const { spf, dmarc } = e;

  // Subdomínio de plataforma (app.vercel.app): o DNS é da plataforma, o dono não consegue publicar SPF/DMARC
  if (e.platform && !hasMx && !spf.record && !dmarc.record) {
    out.push(
      check(
        "spf", "email", "SPF e DMARC", 0, "info",
        `Não se aplica: o DNS de *.${e.platform} é da plataforma. Num domínio próprio, publique "v=spf1 -all" e DMARC p=reject`,
      ),
    );
    return out;
  }

  // SPF
  if (!spf.record) {
    out.push(
      hasMx
        ? check("spf", "email", "SPF", 5, "fail", "Sem registro SPF: qualquer servidor pode enviar e-mail em nome do domínio")
        : check("spf", "email", "SPF", 3, "warn", "Domínio sem e-mail e sem SPF. Publique \"v=spf1 -all\" para bloquear falsificação"),
    );
  } else if (spf.all === "+all") {
    out.push(check("spf", "email", "SPF", 5, "fail", "SPF com +all: autoriza qualquer remetente (equivale a não ter SPF)"));
  } else if (spf.lookups > 10) {
    out.push(check("spf", "email", "SPF", 5, "fail", `${spf.lookups} consultas DNS (limite 10): o SPF falha com PermError e é ignorado`));
  } else if (spf.all === "?all" || spf.all === null) {
    out.push(check("spf", "email", "SPF", 5, "warn", `Termina em ${spf.all ?? "(sem all)"}: neutro, não bloqueia falsificações`));
  } else {
    out.push(check("spf", "email", "SPF", 5, "pass", `${spf.all} · ${spf.lookups}/10 consultas DNS`));
  }

  // DMARC (herdado do domínio pai: o que vale é sp=, ou p= se não houver sp)
  const effective = dmarc.inheritedFrom ? (dmarc.subdomainPolicy ?? dmarc.policy) : dmarc.policy;
  const from = dmarc.inheritedFrom ? ` (herdado de ${dmarc.inheritedFrom})` : "";
  if (!dmarc.record) {
    out.push(check("dmarc", "email", "DMARC", 6, "fail", "Sem DMARC: e-mails falsificados com o seu domínio chegam à caixa de entrada"));
  } else if (effective === "none") {
    out.push(check("dmarc", "email", "DMARC", 6, "warn", `Política none${from} só monitora: não bloqueia nenhum e-mail falsificado`));
  } else if (dmarc.pct < 100) {
    out.push(check("dmarc", "email", "DMARC", 6, "warn", `${effective}${from}, mas aplicado a só ${dmarc.pct}% das mensagens`));
  } else {
    out.push(
      check("dmarc", "email", "DMARC", 6, "pass", `${effective}${from}${dmarc.reporting ? " · relatórios ativos" : " · sem relatórios (rua)"}`),
    );
  }

  if (hasMx || spf.record) {
    out.push(
      check(
        "dkim", "email", "DKIM", 0, "info",
        e.dkim.length
          ? `Chave encontrada nos seletores: ${e.dkim.join(", ")}`
          : "Nenhuma chave nos seletores comuns (pode usar um seletor personalizado)",
      ),
    );
  }

  if (hasMx) {
    out.push(
      check(
        "mta-sts", "email", "MTA-STS", 2,
        e.mtaSts.record && e.mtaSts.mode === "enforce" ? "pass" : "warn",
        !e.mtaSts.record
          ? "Ausente: e-mails recebidos podem ser rebaixados para texto puro (downgrade STARTTLS)"
          : `Política em modo ${e.mtaSts.mode ?? "desconhecido"}${e.mtaSts.mode === "enforce" ? "" : " (só enforce protege)"}`,
      ),
      check("tls-rpt", "email", "TLS-RPT", 0, "info", e.tlsRpt ? "Relatórios de falha TLS ativos" : "Sem relatórios TLS-RPT"),
    );
  }

  if (e.dnssec !== null) {
    out.push(
      check(
        "dnssec", "dns", "DNSSEC", 3,
        e.dnssec ? "pass" : "warn",
        e.dnssec ? "Zona assinada e validada" : "Zona sem DNSSEC: respostas DNS podem ser forjadas (cache poisoning)",
      ),
    );
  }
  return out;
}
