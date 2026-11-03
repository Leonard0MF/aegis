import { runScan, ScanError } from "@/lib/scanner";
import { fail, readTarget } from "@/lib/scanner/target";

export const maxDuration = 60;

export async function POST(req: Request) {
  const target = await readTarget(req);
  if ("error" in target) return target.error;

  try {
    return Response.json(await runScan(target.domain, target.ips));
  } catch (err) {
    if (err instanceof ScanError) return fail(err.message, err.status);
    console.error("scan failed", err);
    return fail("Scan failed", 500);
  }
}
