import dns from "node:dns/promises";
import type { DnsInfo } from "@/types/scan";

const join = (chunks: string[]) => chunks.join("");

/** Registros DNS de e-mail e de certificado. Falhas individuais viram vazio. */
export async function inspectDns(domain: string): Promise<DnsInfo> {
  const [txt, dmarc, mx, caa] = await Promise.allSettled([
    dns.resolveTxt(domain),
    dns.resolveTxt(`_dmarc.${domain}`),
    dns.resolveMx(domain),
    dns.resolveCaa(domain),
  ]);

  const spf =
    txt.status === "fulfilled"
      ? txt.value.map(join).find((r) => /^v=spf1\b/i.test(r)) ?? null
      : null;

  const dmarcRec =
    dmarc.status === "fulfilled"
      ? dmarc.value.map(join).find((r) => /^v=DMARC1\b/i.test(r)) ?? null
      : null;

  return {
    spf,
    dmarc: dmarcRec,
    mx:
      mx.status === "fulfilled"
        ? mx.value.sort((a, b) => a.priority - b.priority).map((r) => r.exchange).slice(0, 10)
        : [],
    caa:
      caa.status === "fulfilled"
        ? caa.value
            .map((r) => r.issue ?? r.issuewild ?? r.iodef)
            .filter((v): v is string => !!v)
            .slice(0, 10)
        : [],
  };
}
