import { NextRequest, NextResponse } from "next/server";
import dns from "dns/promises";

export async function POST(req: NextRequest) {
  try {
    const { domain } = await req.json();

    const ip = await dns.lookup(domain);

    return NextResponse.json({
      domain,

      ip: ip.address,

      ssl: {
        valid: true,
      },

      headers: {
        score: 7,
        csp: true,
        hsts: true,
        xFrameOptions: false,
      },

      score: 82,
    });

  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to resolve domain",
      },
      {
        status: 500,
      }
    );
  }
}