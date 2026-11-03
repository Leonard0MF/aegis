import { readTarget } from "@/lib/scanner/target";
import { inspectSurface, surfaceChecks } from "@/lib/scanner/surface";

export const maxDuration = 60;

/** Superfície de ataque: subdomínios (Certificate Transparency) + subdomain takeover. */
export async function POST(req: Request) {
  const target = await readTarget(req);
  if ("error" in target) return target.error;
  const surface = await inspectSurface(target.domain);
  return Response.json({ surface, checks: surfaceChecks(surface) });
}
