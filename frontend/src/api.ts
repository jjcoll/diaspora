import type { Contractor } from "./types";

const API_BASE = "";

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: Record<string, unknown> }
  | { type: "error"; message: string };

export async function listContractors(): Promise<Contractor[]> {
  const r = await fetch(`${API_BASE}/api/contractors`);
  if (!r.ok) throw new Error(`contractors ${r.status}`);
  return r.json();
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append("audio", blob, blob.type.includes("ogg") ? "audio.ogg" : "audio.webm");
  const r = await fetch(`${API_BASE}/api/transcribe`, { method: "POST", body: fd });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`transcribe ${r.status}: ${detail}`);
  }
  const { text } = (await r.json()) as { text: string };
  return text;
}

export interface InvoiceFields {
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  invoice_ref: string | null;
}

export async function extractInvoice(
  file: File,
): Promise<{ fields: InvoiceFields; prefilled: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${API_BASE}/api/extract-invoice`, { method: "POST", body: fd });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`extract-invoice ${r.status}: ${detail}`);
  }
  return r.json();
}

export async function* sendChat(
  sessionId: string,
  message: string,
): AsyncGenerator<AgentEvent> {
  const r = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!r.ok || !r.body) throw new Error(`chat ${r.status}`);

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, nl);
      buf = buf.slice(nl + 2);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: done")) return;
        if (line.startsWith("data: ")) {
          const payload = line.slice(6);
          if (payload && payload !== "{}") {
            yield JSON.parse(payload) as AgentEvent;
          }
        }
      }
    }
  }
}
