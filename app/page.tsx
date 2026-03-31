import { loadCustomers } from "@/lib/customers";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function DocsPage() {
  const customers = loadCustomers();

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-white">fg-license</h1>
        <p className="mt-1 text-gray-400">
          Stateless JWT-based feature license server. Deployed at{" "}
          <span className="text-green-400">{appUrl}</span>
        </p>
      </header>

      {/* Endpoints */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">Endpoints</h2>
        <table className="w-full text-sm border border-gray-800">
          <thead className="bg-gray-900">
            <tr>
              <th className="text-left p-2 text-gray-400">Method</th>
              <th className="text-left p-2 text-gray-400">Path</th>
              <th className="text-left p-2 text-gray-400">Purpose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {[
              ["POST", "/api/license", "Issue JWT for a customer"],
              ["POST", "/api/verify", "Verify a JWT, return claims"],
              ["GET", "/api/.well-known/jwks.json", "Public key (JWKS format)"],
              ["GET", "/api/health", "Liveness probe"],
            ].map(([method, path, desc]) => (
              <tr key={path} className="hover:bg-gray-900/50">
                <td className="p-2 text-blue-400">{method}</td>
                <td className="p-2 text-yellow-300">{path}</td>
                <td className="p-2 text-gray-300">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Customers */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">Registered Customers</h2>
        <table className="w-full text-sm border border-gray-800">
          <thead className="bg-gray-900">
            <tr>
              <th className="text-left p-2 text-gray-400">ID</th>
              <th className="text-left p-2 text-gray-400">Auth</th>
              <th className="text-left p-2 text-gray-400">Features</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-900/50">
                <td className="p-2 text-green-400">{c.id}</td>
                <td className="p-2 text-gray-400">{c.secretHash ? "secret required" : "open"}</td>
                <td className="p-2 text-gray-300">{c.features.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Usage examples */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-200">Usage</h2>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Issue a token</h3>
          <pre className="bg-gray-900 p-4 rounded text-xs overflow-x-auto text-gray-300">{`# Without API secret (open customer):
curl -X POST ${appUrl}/api/license \\
  -H 'Content-Type: application/json' \\
  -d '{"customerId":"customerA"}'

# With API secret:
curl -X POST ${appUrl}/api/license \\
  -H 'Content-Type: application/json' \\
  -d '{"customerId":"customerB","apiSecret":"your-raw-secret"}'`}</pre>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Verify a token</h3>
          <pre className="bg-gray-900 p-4 rounded text-xs overflow-x-auto text-gray-300">{`curl -X POST ${appUrl}/api/verify \\
  -H 'Content-Type: application/json' \\
  -d '{"token":"<JWT>"}'`}</pre>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Client integration (server-side)</h3>
          <pre className="bg-gray-900 p-4 rounded text-xs overflow-x-auto text-gray-300">{`// lib/license.ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('${appUrl}/api/.well-known/jwks.json')
);
let cache: { jwt: string; exp: number } | null = null;

export async function getLicenseToken() {
  if (cache && cache.exp - Date.now() / 1000 > 600) return cache.jwt;
  const res = await fetch('${appUrl}/api/license', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: process.env.LICENSE_CUSTOMER_ID }),
  });
  const data = await res.json();
  cache = { jwt: data.token, exp: new Date(data.expiresAt).getTime() / 1000 };
  return data.token;
}

// Feature gate in a route handler:
const features = req.headers.get('X-License-Features')?.split(',') ?? [];
if (!features.includes('analytics')) {
  return Response.json({ error: 'Not licensed' }, { status: 403 });
}`}</pre>
        </div>
      </section>
    </main>
  );
}
