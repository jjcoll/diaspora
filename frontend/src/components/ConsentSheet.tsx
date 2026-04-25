import { flagFor, formatEUR } from "../lib/format";

export interface ConsentData {
  amount: number;
  currency: string;
  recipientName: string;
  recipientCountry: string;
  memo: string;
  settlementAmount: number;
  settlementToken: string;
  fxRate: number;
  totalFeeEur: number;
  countdownSec?: number;
}

interface Props {
  data: ConsentData;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConsentSheet({ data: d, onConfirm, onCancel }: Props) {
  return (
    <>
      <div className="sheet-overlay" onClick={onCancel} />
      <div className="sheet" role="dialog">
        <div className="sheet-grabber" />
        <div className="sheet-title">Confirm payment</div>
        <div className="sheet-amount">
          €{d.amount.toLocaleString()}
          <div className="to">
            to {d.recipientName} {flagFor(d.recipientCountry)}
          </div>
        </div>
        <div className="sheet-sub">"{d.memo}"</div>

        <div className="sheet-rows">
          <div className="sheet-row">
            <span className="k">From</span>
            <span className="v">
              bunq business
              <span className="small">•••• 7742</span>
            </span>
          </div>
          <div className="sheet-row">
            <span className="k">They receive</span>
            <span className="v">
              {d.settlementAmount.toFixed(2)} {d.settlementToken}
              <span className="small">on Base · &lt; 20s</span>
            </span>
          </div>
          <div className="sheet-row">
            <span className="k">FX rate</span>
            <span className="v">
              <span className="mono">{d.fxRate.toFixed(4)} {d.currency}/{d.settlementToken}</span>
              <span className="small">Chainlink oracle</span>
            </span>
          </div>
          <div className="sheet-row">
            <span className="k">Total fees</span>
            <span className="v">
              <span className="mono">{formatEUR(d.totalFeeEur)}</span>
              <span className="small">network + spread</span>
            </span>
          </div>
        </div>

        {d.countdownSec !== undefined && (
          <div className="sheet-timer">Quote expires in {d.countdownSec}s</div>
        )}
        <div className="sheet-actions">
          <button className="btn primary" onClick={onConfirm}>
            Confirm & send
          </button>
          <button className="btn subtle" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </>
  );
}
