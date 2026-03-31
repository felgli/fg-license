import { NextResponse } from "next/server";
import { getPublicKeyJwk } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jwk = await getPublicKeyJwk();
    return NextResponse.json(
      { keys: [jwk] },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err) {
    console.error("[jwks] Failed to export public key:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
