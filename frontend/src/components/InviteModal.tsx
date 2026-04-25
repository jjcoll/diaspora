import { useState } from "react";
import { inviteContractor } from "../api";
import { COUNTRY_FLAGS, COUNTRY_NAMES } from "../lib/format";
import type { InviteResponse } from "../types";

interface Props {
  onClose: () => void;
  onInvited: (
    invite: InviteResponse,
    form: { name: string; email: string; country: string; wallet_address: string },
  ) => void;
}

export default function InviteModal({ onClose, onInvited }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("VE");
  const [wallet, setWallet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const invite = await inviteContractor({
        name,
        email,
        country,
        wallet_address: wallet,
      });
      onInvited(invite, { name, email, country, wallet_address: wallet });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = name.trim() && email.trim() && wallet.trim() && !submitting;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grabber" />
        <h3>Invite someone to pay</h3>
        <p className="sub">
          They'll get a link to verify identity via Didit. Takes about 2 minutes.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Full legal name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="As on government ID"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>
          <div className="field">
            <label>Country</label>
            <select
              className="select"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {Object.keys(COUNTRY_NAMES).map((code) => (
                <option key={code} value={code}>
                  {COUNTRY_FLAGS[code]} {COUNTRY_NAMES[code]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Wallet address</label>
            <input
              className="input mono"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x… (Base network)"
              required
            />
          </div>
          {error && (
            <div style={{ color: "var(--red-ink)", fontSize: 12, marginTop: 6 }}>
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={!canSubmit}
            >
              {submitting ? "Sending…" : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
