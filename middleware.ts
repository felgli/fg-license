import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = "*"; // License server is public; per-route auth handles security.

export function middleware(request: NextRequest) {
  const { method } = request;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: corsHeaders(),
    });
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Referrer-Policy", "no-referrer");

  // CORS headers
  for (const [key, value] of Object.entries(corsHeaders())) {
    response.headers.set(key, value);
  }

  return response;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export const config = {
  matcher: ["/api/:path*"],
};
