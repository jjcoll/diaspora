import Icon from "./Icon";
import { formatEUR } from "../lib/format";
import type { ReceiptData } from "./Receipt";

interface Props {
  data: ReceiptData;
  onView: () => void;
}

export default function ReceiptSummary({ data: d, onView }: Props) {
  return (
    <div className="receipt-summary">
      <div className="rs-check">
        <Icon name="check" size={18} />
      </div>
      <div className="rs-body">
        <div className="rs-amount">{formatEUR(d.amount)}</div>
        <div className="rs-sub">sent to {d.recipientName}</div>
        <div className="rs-id">{d.paymentId}</div>
      </div>
      <button className="rs-view" onClick={onView}>
        View receipt
      </button>
    </div>
  );
}
