import Icon from "./Icon";
import { Pill, StatusPill } from "./Pill";
import { countryName, flagFor, formatDate, formatEUR } from "../lib/format";
import type { Contractor } from "../types";

interface Props {
  contractor: Contractor;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export default function ContractorDrawer({ contractor: c, onClose, onToast }: Props) {
  const verified = c.status === "verified";
  const paid = c.paid_total_eur ?? 0;
  const count = c.payments_count ?? 0;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog">
        <div className="drawer-grabber" />
        <div className="drawer-head">
          <div className="flag-ring">{flagFor(c.country)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="drawer-title">{c.name}</div>
            <div className="drawer-sub">
              {countryName(c.country)} · added {formatDate(c.created_at)}
            </div>
          </div>
          <StatusPill status={c.status} />
        </div>
        <div className="drawer-body">
          <div className="drawer-section">
            <h5>Identity</h5>
            <div className="kv">
              <div className="k">Legal name</div>
              <div className="v">{c.name}</div>
              <div className="k">Email</div>
              <div className="v">{c.email}</div>
              <div className="k">Country</div>
              <div className="v">{countryName(c.country)}</div>
              <div className="k">KYC session</div>
              <div className="v mono">{c.didit_session_id || "—"}</div>
              <div className="k">Verified</div>
              <div className="v">
                {c.verified_at ? formatDate(c.verified_at) : "Awaiting"}
              </div>
              <div className="k">ID</div>
              <div className="v mono">{c.id}</div>
            </div>
          </div>

          <div className="drawer-section">
            <h5>
              <span>Wallet</span>
              <button
                className="btn sm subtle"
                onClick={() => {
                  navigator.clipboard?.writeText(c.wallet_address);
                  onToast("Copied");
                }}
              >
                <Icon name="copy" size={11} />Copy
              </button>
            </h5>
            <div className="kv">
              <div className="k">Address</div>
              <div className="v mono">{c.wallet_address}</div>
              <div className="k">Chain</div>
              <div className="v">Base · USDC</div>
              <div className="k">Balance</div>
              <div className="v mono">{verified ? "412.87 USDC" : "—"}</div>
              <div className="k">Explorer</div>
              <div className="v">
                <a
                  href={`https://basescan.org/address/${c.wallet_address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  basescan.org ↗
                </a>
              </div>
            </div>
          </div>

          <div className="drawer-section">
            <h5>Payments</h5>
            {count === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>No payments yet.</div>
            ) : (
              <div className="kv">
                <div className="k">Total paid</div>
                <div className="v">
                  <strong>{formatEUR(paid)}</strong> · {count} payment{count === 1 ? "" : "s"}
                </div>
              </div>
            )}
          </div>

          <div className="drawer-section">
            <h5>Compliance</h5>
            <div className="kv">
              <div className="k">Sanctions</div>
              <div className="v">
                Clear · {formatDate(c.verified_at ?? c.created_at)}
              </div>
              <div className="k">PEP</div>
              <div className="v">Clear</div>
              <div className="k">Travel rule</div>
              <div className="v">Not required under €1,000</div>
              <div className="k">KYC provider</div>
              <div className="v">
                <Pill kind="verified"><Icon name="check" size={9} />Didit</Pill>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
