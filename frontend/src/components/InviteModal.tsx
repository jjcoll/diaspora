import { useState } from "react";
import { COUNTRY_FLAGS, COUNTRY_NAMES } from "../lib/format";

export interface InviteForm {
  name: string;
  email: string;
  country: string;
  wallet_address: string;
}

interface Props {
  onClose: () => void;
  onSubmit: (form: InviteForm) => void;
}

export default function InviteModal({ onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("VE");
  const [wallet, setWallet] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, email, country, wallet_address: wallet });
  }

  const canSubmit = name.trim() && email.trim() && wallet.trim();

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
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={!canSubmit}
            >
              Send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
