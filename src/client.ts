import type { Mandate, ActionRecord } from "@tensflare/tap";
import { generateKeypair, signPayload, verifySignature } from "./crypto.js";
import type { Keypair } from "./crypto.js";

export interface TrussClientOptions {
  baseUrl?: string;
}

export interface CreateMandateInput {
  mandate_id: string;
  agent_id: string;
  agent_name: string;
  issuing_principal: Mandate["issuing_principal"];
  scope: Mandate["scope"];
  jurisdiction_context: Mandate["jurisdiction_context"];
  validity: Mandate["validity"];
}

export interface RecordActionInput {
  record_id: string;
  mandate_id: string;
  action_type: string;
  timestamp: string;
  agent_id: string;
  input_hash: string;
  output_hash: string;
  chain_position: number;
  prev_record_hash: string | null;
}

export class TrussClient {
  private baseUrl: string;
  private apiKey: string;
  private agentId?: string;

  constructor(
    apiKey: string,
    options?: TrussClientOptions & { agentId?: string },
  ) {
    this.apiKey = apiKey;
    this.baseUrl = options?.baseUrl ?? "http://localhost:4000";
    this.agentId = options?.agentId;
  }

  static generateKeypair(): Promise<Keypair> {
    return generateKeypair();
  }

  async createMandate(
    input: CreateMandateInput,
    privateKey: string,
  ): Promise<{ mandate_id: string; status: string }> {
    const body: Record<string, unknown> = {
      ...input,
      version: "1.0",
      issuer_public_key: "",
      signature: "",
    };

    const signature = await signPayload(
      { ...body, signature: undefined },
      privateKey,
    );
    body.signature = signature;

    const res = await fetch(`${this.baseUrl}/mandates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to create mandate: ${res.status} ${JSON.stringify(err)}`);
    }

    return res.json();
  }

  async recordAction(
    input: RecordActionInput,
    privateKey: string,
  ): Promise<{ record_id: string; chain_position: number }> {
    const body: Record<string, unknown> = {
      ...input,
      within_mandate: true,
      signature: "",
    };

    const signature = await signPayload(
      { ...body, signature: undefined },
      privateKey,
    );
    body.signature = signature;

    const res = await fetch(`${this.baseUrl}/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to record action: ${res.status} ${JSON.stringify(err)}`);
    }

    return res.json();
  }

  async getMandate(mandateId: string): Promise<Mandate> {
    const res = await fetch(`${this.baseUrl}/mandates/${mandateId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to get mandate: ${res.status}`);
    }

    return res.json();
  }

  async getAction(recordId: string): Promise<ActionRecord> {
    const res = await fetch(`${this.baseUrl}/actions/${recordId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to get action: ${res.status}`);
    }

    return res.json();
  }

  async getMandateChain(mandateId: string): Promise<{ chain: unknown[] }> {
    const res = await fetch(`${this.baseUrl}/mandates/${mandateId}/chain`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to get chain: ${res.status}`);
    }

    return res.json();
  }

  action(actionType: string, mandateId: string, privateKey: string) {
    return new ActionContext(this, actionType, mandateId, privateKey);
  }
}

export class ActionContext {
  private client: TrussClient;
  private actionType: string;
  private mandateId: string;
  private privateKey: string;
  private inputHash?: string;
  private outputHash?: string;

  constructor(
    client: TrussClient,
    actionType: string,
    mandateId: string,
    privateKey: string,
  ) {
    this.client = client;
    this.actionType = actionType;
    this.mandateId = mandateId;
    this.privateKey = privateKey;
  }

  recordInput(inputHash: string): void {
    this.inputHash = inputHash;
  }

  recordOutput(outputHash: string): void {
    this.outputHash = outputHash;
  }

  async commit(agentId: string, chainPosition: number, prevRecordHash: string | null): Promise<{ record_id: string; chain_position: number }> {
    if (!this.inputHash) {
      throw new Error("input_hash not set. Call recordInput() before commit.");
    }
    if (!this.outputHash) {
      throw new Error("output_hash not set. Call recordOutput() before commit.");
    }

    const recordId = `act_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

    return this.client.recordAction(
      {
        record_id: recordId,
        mandate_id: this.mandateId,
        action_type: this.actionType,
        timestamp: new Date().toISOString(),
        agent_id: agentId,
        input_hash: this.inputHash,
        output_hash: this.outputHash,
        chain_position: chainPosition,
        prev_record_hash: prevRecordHash,
      },
      this.privateKey,
    );
  }
}
