import { useEffect, useRef, useState } from "react";
import Composer from "../components/Composer";
import QuoteCard, { type QuoteData } from "../components/QuoteCard";
import { type ReceiptData } from "../components/Receipt";
import ReceiptModal from "../components/ReceiptModal";
import ReceiptSummary from "../components/ReceiptSummary";
import Timeline, { type TimelineStep } from "../components/Timeline";
import { sendChat, type AgentEvent } from "../api";

const STEP_LABEL: Record<string, string> = {
  list_contractors: "Listing contacts",
  resolve_contractor: "Resolving recipient",
  check_balance: "Checking balance",
  aml_screen: "Compliance screening",
  generate_fx_quote: "FX quote",
  execute_sepa_payment: "Executing payment",
};

interface ChatMsg {
  role: "user" | "agent";
  text: string;
}

interface QuoteState {
  recipient_name?: string;
  country?: string;
  wallet?: string;
  invoice_ref?: string;
  balance?: number;
  balance_currency?: string;
  aml_cleared?: boolean;
  eur_amount?: number;
  usdc_amount?: number;
  fx_rate?: number;
  fee_eur?: number;
  gas_usd?: number;
  eta?: string;
}

export default function PaymentsTab() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [steps, setSteps] = useState<TimelineStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const sessionRef = useRef<string>(
    Math.random().toString(36).slice(2) + Date.now().toString(36),
  );
  const collected = useRef<QuoteState>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat, steps, quote, receipt]);

  useEffect(() => {
    const pad = document.querySelector(".stage-pad") as HTMLElement | null;
    const app = document.querySelector(".app") as HTMLElement | null;
    if (!pad || !app) return;
    const update = () => {
      app.dataset.overflow = String(pad.scrollHeight > pad.clientHeight + 4);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(pad);
    const mo = new MutationObserver(update);
    mo.observe(pad, { childList: true, subtree: true, characterData: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      if (app) delete app.dataset.overflow;
    };
  }, []);

  async function send(msg: string) {
    if (!msg.trim() || busy) return;
    setBusy(true);
    setChat((c) => [...c, { role: "user", text: msg }]);

    try {
      for await (const ev of sendChat(sessionRef.current, msg)) {
        applyEvent(ev);
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      setChat((c) => [...c, { role: "agent", text: `error: ${m}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(msg: string) {
    setMessage("");
    await send(msg);
  }

  function applyEvent(ev: AgentEvent) {
    if (ev.type === "text") {
      // Suppress the boilerplate completion line — the Receipt component renders the result.
      if (ev.text.trim().toLowerCase() === "done.") return;
      setChat((c) => [...c, { role: "agent", text: ev.text }]);
    } else if (ev.type === "tool_use") {
      const title = STEP_LABEL[ev.name] ?? ev.name;
      setSteps((s) => (s.some((x) => x.title === title) ? s : [...s, { title, status: "running" }]));
    } else if (ev.type === "tool_result") {
      const title = STEP_LABEL[ev.name] ?? ev.name;
      setSteps((s) =>
        s.map((x) => (x.title === title ? { ...x, status: "done", sub: subFor(ev.name, ev.result) } : x)),
      );
      collectFromTool(ev.name, ev.result);
    } else if (ev.type === "error") {
      setChat((c) => [...c, { role: "agent", text: `error: ${ev.message}` }]);
    }
  }

  function subFor(name: string, r: Record<string, unknown>): string | undefined {
    if (name === "check_balance") return `${r.currency} ${r.balance}`;
    if (name === "resolve_contractor" && r.found) return `${r.name} · ${r.country}`;
    if (name === "generate_fx_quote") return `EUR ${r.eur_amount} → ${r.usdc_amount} USDC`;
    if (name === "aml_screen") return `${r.risk_score}`;
    if (name === "execute_sepa_payment") {
      const settlement = r.settlement as Record<string, unknown> | undefined;
      return settlement?.tx_hash ? `tx ${String(settlement.tx_hash).slice(0, 10)}…` : "executed";
    }
    return undefined;
  }

  function collectFromTool(name: string, r: Record<string, unknown>) {
    const c = collected.current;
    if (name === "resolve_contractor" && r.found) {
      c.recipient_name = r.name as string;
      c.country = r.country as string;
      c.wallet = r.wallet as string;
      c.invoice_ref = r.invoice_ref as string;
    } else if (name === "check_balance") {
      c.balance = r.balance as number;
      c.balance_currency = r.currency as string;
    } else if (name === "aml_screen") {
      c.aml_cleared = r.cleared as boolean;
    } else if (name === "generate_fx_quote") {
      c.eur_amount = r.eur_amount as number;
      c.usdc_amount = r.usdc_amount as number;
      c.fx_rate = r.fx_rate as number;
      c.fee_eur = r.fee_eur as number;
      c.gas_usd = r.gas_usd as number;
      c.eta = r.eta as string;

      if (c.recipient_name && c.country && c.eur_amount != null) {
        setQuote({
          recipientName: c.recipient_name,
          recipientCountry: c.country,
          invoiceRef: c.invoice_ref,
          eurAmount: c.eur_amount,
          usdcAmount: c.usdc_amount ?? 0,
          fxRate: c.fx_rate ?? 0,
          feeEur: c.fee_eur ?? 0,
          gasUsd: c.gas_usd ?? 0,
          eta: c.eta ?? "~20s",
          amlCleared: c.aml_cleared ?? false,
          balanceOk: (c.balance ?? 0) >= (c.eur_amount ?? 0),
        });
      }
    } else if (name === "execute_sepa_payment") {
      const settlement = (r.settlement ?? {}) as Record<string, unknown>;
      const audit = (r.audit ?? {}) as Record<string, unknown>;
      const txHash = String(settlement.tx_hash ?? "");
      const block = Number(settlement.block_number ?? 0);
      setReceipt({
        receiptId: String(r.reference_id ?? ""),
        paymentId: String(r.payment_id ?? ""),
        amount: c.eur_amount ?? 0,
        currency: "EUR",
        recipientName: c.recipient_name ?? "",
        recipientCountry: c.country ?? "",
        recipientWallet: c.wallet ?? "",
        settlementAmount: c.usdc_amount ?? 0,
        settlementToken: "USDC",
        fxRate: c.fx_rate ?? 0,
        txHash,
        blockNumber: block,
        blockExplorerUrl: String(settlement.explorer_url ?? ""),
        signedAt: new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC",
        sha256: String(audit.receipt_hash ?? ""),
      });
      setQuote(null);
    }
  }

  function handleConfirm() {
    setQuote(null);
    void send("yes");
  }

  function handleCancel() {
    setQuote(null);
    void send("no");
  }

  const showComposer = !quote;

  return (
    <div className="stage-pad">
      <div className="chat">
        {chat.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.text}
          </div>
        ))}
        {steps.length > 0 && <Timeline steps={steps} />}
        {quote && (
          <QuoteCard
            quote={quote}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            disabled={busy}
          />
        )}
        {receipt && (
          <ReceiptSummary data={receipt} onView={() => setReceiptOpen(true)} />
        )}
        <div ref={bottomRef} />
      </div>
      {receipt && receiptOpen && (
        <ReceiptModal data={receipt} onClose={() => setReceiptOpen(false)} />
      )}
      {showComposer && (
        <div className="composer-dock">
          <Composer
            message={message}
            setMessage={setMessage}
            onSubmit={handleSubmit}
            disabled={busy}
          />
        </div>
      )}
    </div>
  );
}
