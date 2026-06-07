import { describe, it, expect } from "vitest";
import { generateKeypair, signPayload, verifySignature } from "./crypto.js";

describe("crypto", () => {
  it("generateKeypair produces hex-encoded keys", async () => {
    const kp = await generateKeypair();
    expect(kp.publicKey).toMatch(/^[0-9a-f]{64}$/i);
    expect(kp.privateKey).toMatch(/^[0-9a-f]{128}$/i);
  });

  it("signPayload and verifySignature round-trip", async () => {
    const kp = await generateKeypair();
    const payload = { action: "test", value: 42 };

    const sig = await signPayload(payload, kp.privateKey);
    expect(sig).toMatch(/^[0-9a-f]{128}$/i);

    const valid = await verifySignature(payload, sig, kp.publicKey);
    expect(valid).toBe(true);
  });

  it("verifySignature rejects wrong signature", async () => {
    const kp1 = await generateKeypair();
    const kp2 = await generateKeypair();
    const payload = { action: "test" };

    const sig = await signPayload(payload, kp1.privateKey);
    const valid = await verifySignature(payload, sig, kp2.publicKey);
    expect(valid).toBe(false);
  });

  it("verifySignature rejects tampered payload", async () => {
    const kp = await generateKeypair();
    const payload = { action: "test" };

    const sig = await signPayload(payload, kp.privateKey);
    const tampered = { action: "tampered" };
    const valid = await verifySignature(tampered, sig, kp.publicKey);
    expect(valid).toBe(false);
  });

  it("signature is deterministic for same payload", async () => {
    const kp = await generateKeypair();
    const payload = { msg: "hello", num: 1 };

    const sig1 = await signPayload(payload, kp.privateKey);
    const sig2 = await signPayload(payload, kp.privateKey);
    expect(sig1).toBe(sig2);
  });
});
