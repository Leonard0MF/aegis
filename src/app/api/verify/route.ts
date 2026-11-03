import { fail, readTarget } from "@/lib/scanner/target";
import { checkOwnership, FILE_PATH, tokenFor, TXT_PREFIX } from "@/lib/scanner/verify";

/**
 * POST { domain } → instruções de verificação + estado atual.
 * Gerar o token não libera nada: só quem publica o registro DNS (ou o arquivo) prova a propriedade.
 */
export async function POST(req: Request) {
  const target = await readTarget(req);
  if ("error" in target) return target.error;
  const { domain } = target;

  const token = tokenFor(domain);
  if (!token) return fail("Servidor sem AEGIS_SECRET configurado", 503);

  const status = await checkOwnership(domain, true);
  return Response.json({
    domain,
    ...status,
    dns: { name: `${TXT_PREFIX}.${domain}`, type: "TXT", value: `aegis-verify=${token}` },
    file: { url: `https://${domain}${FILE_PATH}`, content: token },
  });
}
