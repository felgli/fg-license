import { SignJWT, jwtVerify, importPKCS8, importSPKI, exportJWK, type KeyLike } from "jose";
import { randomUUID } from "node:crypto";

export interface LicensePayload {
  licenseId: string;
  customerId: string;
  features: string[];
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

const TTL_SECONDS = 3600; // 1 hour
const ISSUER = "fg-license";

// Keys cached after first load to avoid re-parsing on every request.
let _privateKey: KeyLike | null = null;
let _publicKey: KeyLike | null = null;

async function getPrivateKey(): Promise<KeyLike> {
  if (_privateKey) return _privateKey;
  const b64 = process.env.JWT_PRIVATE_KEY_B64;
  if (!b64) throw new Error("JWT_PRIVATE_KEY_B64 env var is not set");
  const pem = Buffer.from(b64, "base64").toString("utf-8");
  _privateKey = await importPKCS8(pem, "RS256");
  return _privateKey;
}

async function getPublicKey(): Promise<KeyLike> {
  if (_publicKey) return _publicKey;
  const b64 = process.env.JWT_PUBLIC_KEY_B64;
  if (!b64) throw new Error("JWT_PUBLIC_KEY_B64 env var is not set");
  const pem = Buffer.from(b64, "base64").toString("utf-8");
  _publicKey = await importSPKI(pem, "RS256");
  return _publicKey;
}

export async function signLicenseToken(
  customerId: string,
  features: string[]
): Promise<{ token: string; expiresAt: Date }> {
  const privateKey = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TTL_SECONDS;

  const token = await new SignJWT({
    licenseId: randomUUID(),
    customerId,
    features,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(ISSUER)
    .setAudience(customerId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(privateKey);

  return { token, expiresAt: new Date(exp * 1000) };
}

export async function verifyLicenseToken(token: string): Promise<LicensePayload> {
  const publicKey = await getPublicKey();
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: ISSUER,
    algorithms: ["RS256"],
  });
  return payload as unknown as LicensePayload;
}

export async function getPublicKeyJwk(): Promise<Record<string, unknown>> {
  const publicKey = await getPublicKey();
  const jwk = await exportJWK(publicKey);
  return { ...jwk, use: "sig", alg: "RS256", kid: "fg-license-1" };
}
