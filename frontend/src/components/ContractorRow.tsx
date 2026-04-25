import { StatusPill } from "./Pill";
import { countryName, formatEUR, truncateMid } from "../lib/format";
import type { Contractor } from "../types";

interface Props {
  contractor: Contractor;
  onSelect: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ContractorRow({ contractor: c, onSelect }: Props) {
  const verified = c.status === "verified";
  const paid = c.paid_total_eur ?? 0;
  const count = c.payments_count ?? 0;

  return (
    <button className="contractor" onClick={onSelect}>
      <div className="initials-ring">{initials(c.name)}</div>
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
