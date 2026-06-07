import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sodium = require("libsodium-wrappers");

export interface Keypair {
  publicKey: string;
  privateKey: string;
}

let ready: Promise<void> | null = null;

async function ensureReady(): Promise<void> {
  if (!ready) {
    ready = sodium.ready;
  }
  await ready;
}

export async function generateKeypair(): Promise<Keypair> {
  await ensureReady();
  const kp = sodium.crypto_sign_keypair();
  return {
    publicKey: sodium.to_hex(kp.publicKey),
    privateKey: sodium.to_hex(kp.privateKey),
  };
}

export async function signPayload(
  payload: Record<string, unknown>,
  privateKeyHex: string,
): Promise<string> {
  await ensureReady();
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const signature = sodium.crypto_sign_detached(
    sodium.from_string(canonical),
    sodium.from_hex(privateKeyHex),
  );
  return sodium.to_hex(signature);
}

export async function verifySignature(
  payload: Record<string, unknown>,
  signatureHex: string,
  publicKeyHex: string,
): Promise<boolean> {
  await ensureReady();
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return sodium.crypto_sign_verify_detached(
    sodium.from_hex(signatureHex),
    sodium.from_string(canonical),
    sodium.from_hex(publicKeyHex),
  );
}
