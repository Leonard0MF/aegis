import { createHmac, timingSafeEqual } from "node:crypto";
import dns from "node:dns/promises";
import { request } from "./http";

/**
 * Prova de propriedade sem banco de dados: o token é um HMAC do domínio com um
 * segredo do servidor. Só quem controla o DNS (ou o site) consegue publicá-lo.
 */

export const TXT_PREFIX = "_aegis-verify";
export const FILE_PATH = "/.well-known/aegis-verify.txt";

function secret(): string | null {
  return process.env.AEGIS_SECRET && process.env.AEGIS_SECRET.length >= 16 ? process.env.AEGIS_SECRET : null;
}

export function tokenFor(domain: string): string | null {
  const s = secret();
  if (!s) return null;
  return createHmac("sha256", s).update(`aegis-verify:${domain.toLowerCase()}`).digest("hex").slice(0, 32);
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** example.com, depois os pais (verificar a raiz cobre os subdomínios). */
function candidates(domain: string): string[] {
  const labels = domain.split(".");
  const out: string[] = [];
  for (let i = 0; i < labels.length - 1; i++) out.push(labels.slice(i).join("."));
  return out;
}

export interface VerifyResult {
  verified: boolean;
  /** domínio onde a prova foi encontrada */
  via?: string;
  method?: "dns" | "file";
}

const memo = new Map<string, { at: number; value: VerifyResult }>();
const TTL_MS = 5 * 60 * 1000;

export async function checkOwnership(domain: string, fresh = false): Promise<VerifyResult> {
  const hit = memo.get(domain);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let value: VerifyResult = { verified: false };
  for (const c of candidates(domain)) {
    const token = tokenFor(c);
    if (!token) break;
    const records = await dns.resolveTxt(`${TXT_PREFIX}.${c}`).then(
      (r) => r.map((chunks) => chunks.join("").trim()),
      () => [] as string[],
    );
    if (records.some((r) => same(r.replace(/^aegis-verify=/, ""), token))) {
      value = { verified: true, via: c, method: "dns" };
      break;
    }
  }

  if (!value.verified) {
    const token = tokenFor(domain);
    const r = token
      ? await request(new URL(`https://${domain}${FILE_PATH}`), { maxBody: 256, timeoutMs: 5000 })
      : null;
    if (token && r?.status === 200 && same(r.body.trim().replace(/^aegis-verify=/, ""), token)) {
      value = { verified: true, via: domain, method: "file" };
    }
  }

  // só guarda sucesso: quem acabou de publicar o registro quer ver o resultado na hora
  if (value.verified) memo.set(domain, { at: Date.now(), value });
  return value;
}
