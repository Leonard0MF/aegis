import { request } from "@/lib/scanner/http";
import { activeChecks, runActive } from "@/lib/scanner/active";
import { fail, readTarget } from "@/lib/scanner/target";
import { checkOwnership } from "@/lib/scanner/verify";

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
    const active = await runActive(domain, ips[0], https ? "https" : "http");
    return Response.json({ active, checks: activeChecks(active), via: ownership.via });
  } catch (err) {
    console.error("active scan failed", err);
    return fail("Active scan failed", 500);
  }
}
