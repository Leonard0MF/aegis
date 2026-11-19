import { SHARED_EDGE } from "@/lib/infra";
import { locateServers } from "./geo";
import { detectTech } from "./tech";

/**
 * O IP é de uma CDN/hospedagem compartilhada? Então varrer as portas dele é varrer a infraestrutura
 * de terceiros (e de outros clientes), não a do dono do domínio verificado.
 * Retorna o nome do provedor, ou null quando o IP parece ser do próprio dono.
 */
export async function sharedInfra(headers: Headers | null, ip: string): Promise<string | null> {
  const edge = headers ? detectTech(headers, "").find((t) => t.category === "cdn" || t.category === "hosting") : undefined;
  if (edge) return edge.name;
  const [geo] = await locateServers([ip]);
  return geo && SHARED_EDGE.test(geo.org) ? geo.org : null;
}
