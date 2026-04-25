import { countryName, flagFor, formatEUR } from "../lib/format";

export interface QuoteData {
  recipientName: string;
  recipientCountry: string;
  invoiceRef?: string;
  eurAmount: number;
  usdcAmount: number;
  fxRate: number;
  feeEur: number;
  gasUsd: number;
  eta: string;
  amlCleared: boolean;
  balanceOk: boolean;
}

interface Props {
  quote: QuoteData;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

export default function QuoteCard({ quote: q, onConfirm, onCancel, disabled }: Props) {
  return (
    <div className="quote-card">
      <div className="quote-header">
        <div className="quote-flag">{flagFor(q.recipientCountry)}</div>
        <div>
          <div className="quote-name">{q.recipientName}</div>
          <div className="quote-meta">
            {countryName(q.recipientCountry)}
            {q.invoiceRef ? ` · ${q.invoiceRef}` : ""}
          </div>
        </div>
      </div>

      <div className="quote-amounts">
        <div className="quote-leg">
          <div className="leg-label">You send</div>
          <div className="leg-value">{formatEUR(q.eurAmount)}</div>
        </div>
        <div className="quote-arrow">→</div>
        <div className="quote-leg">
          <div className="leg-label">They get</div>
          <div className="leg-value">{q.usdcAmount.toFixed(2)} USDC</div>
        </div>
      </div>

      <div className="quote-rows">
        <div className="quote-row">
          <span>Rate</span>
          <span>1 EUR = {q.fxRate.toFixed(4)} USDC</span>
        </div>
        <div className="quote-row">
          <span>Fee</span>
          <span>{formatEUR(q.feeEur)}</span>
        </div>
        <div className="quote-row">
          <span>Gas</span>
          <span>${q.gasUsd.toFixed(2)}</span>
        </div>
        <div className="quote-row">
          <span>ETA</span>
          <span>{q.eta}</span>
        </div>
      </div>

      <div className="quote-checks">
        <span className={q.amlCleared ? "ok" : "fail"}>
          {q.amlCleared ? "✓" : "✗"} AML cleared
        </span>
        <span className={q.balanceOk ? "ok" : "fail"}>
          {q.balanceOk ? "✓" : "✗"} Balance ok
        </span>
      </div>

      <div className="quote-actions">
        <button className="btn" onClick={onCancel} disabled={disabled}>
          Cancel
        </button>
        <button className="btn primary" onClick={onConfirm} disabled={disabled}>
          Confirm payment
        </button>
      </div>
    </div>
  );
}
