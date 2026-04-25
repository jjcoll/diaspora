import { StatusPill } from "./Pill";
import { countryName, flagFor, formatEUR, truncateMid } from "../lib/format";
import type { Contractor } from "../types";

interface Props {
  contractor: Contractor;
  onSelect: () => void;
}

export default function ContractorRow({ contractor: c, onSelect }: Props) {
  const verified = c.status === "verified";
  const paid = c.paid_total_eur ?? 0;
  const count = c.payments_count ?? 0;

  return (
    <button className="contractor" onClick={onSelect}>
      <div className="flag-ring">{flagFor(c.country)}</div>
      <div className="who">
        <div className="name">{c.name}</div>
        <div className="meta">
          {countryName(c.country)}
          <span style={{ color: "var(--muted-2)" }}>·</span>
          <span className="mono">{truncateMid(c.wallet_address, 4, 3)}</span>
        </div>
      </div>
      <div className="right">
        {verified ? (
          <>
            <div className="amt">{paid > 0 ? formatEUR(paid) : "—"}</div>
            <div className="amt-sub">{count} payments</div>
          </>
        ) : (
          <StatusPill status={c.status} />
        )}
      </div>
    </button>
  );
}
