import Icon from "./Icon";
import { countryName, flagFor, formatEUR, truncateMid } from "../lib/format";

export interface ReceiptData {
  receiptId: string;
  paymentId: string;
  amount: number;
  currency: string;
  recipientName: string;
  recipientCountry: string;
  recipientWallet: string;
  settlementAmount: number;
  settlementToken: string;
  fxRate: number;
  txHash: string;
  blockNumber: number;
  blockExplorerUrl: string;
  signedAt: string;
  sha256: string;
}

interface Props {
  data: ReceiptData;
  onDownload?: () => void;
  onShare?: () => void;
}

export default function Receipt({ data: d, onDownload, onShare }: Props) {
  const spread = d.amount * 0.0008;
  const networkFee = 0.01;
  const totalCharged = d.amount + spread + networkFee;

  return (
    <div className="receipt">
      <div className="receipt-top">
        <div className="receipt-check"><Icon name="check" size={22} /></div>
        <div className="label">Payment complete</div>
        <div className="big">{formatEUR(d.amount)}</div>
        <div className="sub">sent to {d.recipientName}</div>
        <div className="id">{d.receiptId}</div>
      </div>

      <div className="receipt-body">
        <div className="r-group">
          <div className="r-item">
            <div className="role">From</div>
            <div className="pn">Atlas Labs B.V.</div>
            <div className="meta">Amsterdam, NL</div>
            <div className="addr">IBAN NL91 BUNQ 0000 7742 11</div>
          </div>
          <div className="r-item">
            <div className="role">To</div>
            <div className="pn">
              {flagFor(d.recipientCountry)} {d.recipientName}
            </div>
            <div className="meta">{countryName(d.recipientCountry)}</div>
            <div className="addr">{truncateMid(d.recipientWallet, 10, 8)}</div>
          </div>
        </div>

        <div className="r-legs">
          <div className="leg">
            <div className="leg-title">
              <span className="leg-num">1</span> Fiat out · bunq
            </div>
            <div className="leg-row">
              <span className="k">Amount</span>
              <span className="v">{formatEUR(d.amount)}</span>
            </div>
            <div className="leg-row">
              <span className="k">Method</span>
              <span className="v">SEPA instant</span>
            </div>
            <div className="leg-row">
              <span className="k">Payment ID</span>
              <span className="v mono">bq_pmt_{d.paymentId.slice(-12)}</span>
            </div>
          </div>
          <div className="leg">
            <div className="leg-title">
              <span className="leg-num">2</span> Stablecoin · Base
            </div>
            <div className="leg-row">
              <span className="k">Amount</span>
              <span className="v mono">{d.settlementAmount.toFixed(2)} {d.settlementToken}</span>
            </div>
            <div className="leg-row">
              <span className="k">Block</span>
              <span className="v mono">#{d.blockNumber.toLocaleString()}</span>
            </div>
            <div className="leg-row">
              <span className="k">Tx</span>
              <span className="v mono">
                <a href={d.blockExplorerUrl} target="_blank" rel="noreferrer">
                  {truncateMid(d.txHash, 6, 4)} ↗
                </a>
              </span>
            </div>
          </div>
        </div>

        <div className="fee-table">
          <div className="fee-row">
            <div className="k">
              Principal
              <span className="note">{d.currency} → {d.settlementToken} @ {d.fxRate.toFixed(4)}</span>
            </div>
            <div className="v-amt">€{d.amount.toFixed(2)}</div>
          </div>
          <div className="fee-row">
            <div className="k">
              FX spread
              <span className="note">0.08%</span>
            </div>
            <div className="v-amt">€{spread.toFixed(2)}</div>
          </div>
          <div className="fee-row">
            <div className="k">
              Network fee
              <span className="note">Base gas</span>
            </div>
            <div className="v-amt">€{networkFee.toFixed(2)}</div>
          </div>
          <div className="fee-row">
            <div className="k">Total charged</div>
            <div className="v-amt">€{totalCharged.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="receipt-foot">
        <div className="label">Receipt integrity · SHA-256</div>
        <div className="hash">{d.sha256}</div>
        <div className="meta">
          <span>Signed {d.signedAt}</span>
          <span>{d.receiptId}</span>
        </div>
        <div className="receipt-actions">
          <button className="btn" onClick={onDownload}>
            <Icon name="download" size={13} />PDF
          </button>
          <button className="btn" onClick={onShare}>
            <Icon name="link" size={13} />Share
          </button>
        </div>
      </div>
    </div>
  );
}
