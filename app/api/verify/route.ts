import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyLicenseToken } from "@/lib/jwt";
import { rateLimit, getIp } from "@/lib/rate-limit";
import { errors as joseErrors } from "jose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  // Rate limit: 30 requests per minute per IP
  const { allowed } = rateLimit(getIp(request), 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  try {
    const payload = await verifyLicenseToken(parsed.data.token);
    return NextResponse.json({
      ok: true,
      valid: true,
      customerId: payload.customerId,
      features: payload.features,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    });
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return NextResponse.json({ ok: true, valid: false, reason: "expired" });
    }
    return NextResponse.json({ ok: true, valid: false, reason: "invalid" });
  }
}
