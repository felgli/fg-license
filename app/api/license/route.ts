import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findCustomer, authenticateCustomer } from "@/lib/customers";
import { signLicenseToken } from "@/lib/jwt";
import { rateLimit, getIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  customerId: z.string().min(1),
  apiSecret: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const { allowed } = rateLimit(getIp(request), 10, 60_000);
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
    return NextResponse.json(
      { ok: false, error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { customerId, apiSecret } = parsed.data;

  // Always look up the customer and authenticate in constant time.
  // Return the same 401 for "not found" and "wrong secret" to prevent enumeration.
  const customer = findCustomer(customerId);
  const authenticated = customer ? authenticateCustomer(customer, apiSecret) : false;

  if (!authenticated) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  try {
    const { token, expiresAt } = await signLicenseToken(customerId, customer!.features);
    return NextResponse.json({
      ok: true,
      token,
      expiresAt: expiresAt.toISOString(),
      features: customer!.features,
    });
  } catch (err) {
    console.error("[license] Failed to sign token:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
