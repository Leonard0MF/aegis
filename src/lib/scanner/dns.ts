import dns from "node:dns/promises";
import type { DnsInfo } from "@/types/scan";
import { platformOf, registrable } from "./domain";

const join = (chunks: string[]) => chunks.join("");

/** Registros DNS de e-mail e de certificado. Falhas individuais viram vazio. */
export async function inspectDns(domain: string): Promise<DnsInfo> {
  const org = registrable(domain);
  const [txt, dmarc, mx, caa] = await Promise.allSettled([
    dns.resolveTxt(domain),
    findDmarc(domain, org),
    dns.resolveMx(domain),
    findCaa(domain),
  ]);

  const spf =
    txt.status === "fulfilled"
      ? txt.value.map(join).find((r) => /^v=spf1\b/i.test(r)) ?? null
      : null;

  const dmarcRec = dmarc.status === "fulfilled" ? dmarc.value : null;
  const caaRec = caa.status === "fulfilled" ? caa.value : null;

  return {
    spf,
    dmarc: dmarcRec?.record ?? null,
    dmarcFrom: dmarcRec?.from !== domain ? dmarcRec?.from : undefined,
    caaFrom: caaRec?.from !== domain ? caaRec?.from : undefined,
    platform: platformOf(domain),
    mx:
      mx.status === "fulfilled"
        ? mx.value.sort((a, b) => a.priority - b.priority).map((r) => r.exchange).slice(0, 10)
        : [],
    caa: caaRec
        ? caaRec.records
            .map((r) => r.issue ?? r.issuewild ?? r.iodef)
            .filter((v): v is string => !!v)
            .slice(0, 10)
        : [],
  };
}

async function dmarcAt(name: string): Promise<string | null> {
  try {
    return (await dns.resolveTxt(`_dmarc.${name}`)).map(join).find((r) => /^v=DMARC1\b/i.test(r)) ?? null;
  } catch {
    return null;
  }
}

/** DMARC do próprio host ou, na falta dele, do domínio organizacional. */
async function findDmarc(domain: string, org: string) {
  const own = await dmarcAt(domain);
  if (own) return { record: own, from: domain };
  if (org !== domain) {
    const inherited = await dmarcAt(org);
    if (inherited) return { record: inherited, from: org };
  }
  return null;
}

/** CAA vale para o primeiro nome da árvore que tiver registros, subindo até o TLD. */
async function findCaa(domain: string) {
  const labels = domain.replace(/\.$/, "").split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const name = labels.slice(i).join(".");
    try {
      const records = await dns.resolveCaa(name);
      if (records.length) return { records, from: name };
    } catch {
      /* sem CAA neste nível: sobe */
    }
  }
  return null;
}
