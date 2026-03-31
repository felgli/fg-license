#!/usr/bin/env node
/**
 * Generate an RSA-2048 key pair for use with the license server.
 * Run once: node scripts/generate-keys.mjs
 *
 * Output is ready to paste into Vercel environment variables or .env.local.
 * Never commit the output values to version control.
 */

import { generateKeyPairSync, createHash } from "node:crypto";
import { argv } from "node:process";

// ─── Key pair generation ─────────────────────────────────────────────────────

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const privateB64 = Buffer.from(privateKey).toString("base64");
const publicB64 = Buffer.from(publicKey).toString("base64");

console.log("# ─── Paste into Vercel env vars or .env.local ───────────────────────────────");
console.log("");
console.log(`JWT_PRIVATE_KEY_B64=${privateB64}`);
console.log("");
console.log(`JWT_PUBLIC_KEY_B64=${publicB64}`);
console.log("");

// ─── Optional: hash a customer secret ────────────────────────────────────────

const secretArg = argv[2];
if (secretArg) {
  const hash = createHash("sha256").update(secretArg).digest("hex");
  console.log("# ─── Customer secret hash ───────────────────────────────────────────────────");
  console.log(`# Raw secret (hand to customer, never store): ${secretArg}`);
  console.log(`# SHA-256 hash (store in CUSTOMER_REGISTRY):  ${hash}`);
  console.log("");
} else {
  console.log("# TIP: Pass a customer secret as an argument to also hash it:");
  console.log("# node scripts/generate-keys.mjs my-customer-secret");
  console.log("");
}
