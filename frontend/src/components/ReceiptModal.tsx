import { createPortal } from "react-dom";
import Icon from "./Icon";
import Receipt, { type ReceiptData } from "./Receipt";

interface Props {
  data: ReceiptData;
  onClose: () => void;
}

export default function ReceiptModal({ data, onClose }: Props) {
  return createPortal(
    <div className="receipt-modal-overlay" onClick={onClose}>
      <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-modal-bar">
          <div className="receipt-modal-title">
            <Icon name="download" size={13} />
            <span>Receipt · PDF preview</span>
          </div>
          <button className="receipt-modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="receipt-modal-body">
          <Receipt data={data} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
