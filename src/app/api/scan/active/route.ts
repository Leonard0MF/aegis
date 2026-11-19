import { request } from "@/lib/scanner/http";
import { activeChecks, runActive } from "@/lib/scanner/active";
import { fail, readTarget } from "@/lib/scanner/target";
import { checkOwnership } from "@/lib/scanner/verify";
import { sharedInfra } from "@/lib/scanner/shared";

export const maxDuration = 60;

/** Testes ativos (portas + arquivos expostos). Exige prova de propriedade do domínio. */
export async function POST(req: Request) {
  const target = await readTarget(req);
  if ("error" in target) return target.error;
  const { domain, ips } = target;

  const ownership = await checkOwnership(domain);
  if (!ownership.verified) {
    return Response.json(
      { error: "Verifique a propriedade do domínio antes de rodar testes ativos", needsVerification: true },
      { status: 403 },
    );
  }

  const https = await request(new URL(`https://${domain}/`), { timeoutMs: 6000 });
  try {
    // IP de CDN/hospedagem compartilhada: a posse do domínio não autoriza varrer as portas desse IP
    const shared = await sharedInfra(https?.headers ?? null, ips[0]);
    const active = await runActive(domain, ips[0], https ? "https" : "http", shared);
    return Response.json({ active, checks: activeChecks(active), via: ownership.via });
  } catch (err) {
    console.error("active scan failed", err);
    return fail("Falha nos testes ativos", 500);
  }
}
