import { useState } from "react";
import ContractorRow from "../components/ContractorRow";
import ContractorDrawer from "../components/ContractorDrawer";
import InviteModal from "../components/InviteModal";
import Icon from "../components/Icon";
import type { Contractor, InviteResponse } from "../types";

interface Props {
  contractors: Contractor[];
  setContractors: React.Dispatch<React.SetStateAction<Contractor[]>>;
  onToast: (msg: string) => void;
  refreshContractors: () => void;
}

export default function ContractorsTab({
  contractors,
  setContractors,
  onToast,
  refreshContractors,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Contractor | null>(null);
  const [banner, setBanner] = useState<{ name: string; url: string } | null>(null);

  function handleInvited(
    invite: InviteResponse,
    form: { name: string; email: string; country: string; wallet_address: string },
  ) {
    setContractors((prev) => [
      {
        id: invite.contractor_id,
        name: form.name,
        email: form.email,
        country: form.country.toUpperCase(),
        wallet_address: form.wallet_address,
        status: "pending",
        didit_session_id: "",
        verified_at: null,
        created_at: new Date().toISOString(),
        paid_total_eur: 0,
        payments_count: 0,
      },
      ...prev,
    ]);
    setBanner({ name: form.name, url: invite.verification_url });
    setShowModal(false);
    onToast("Invite sent");
    refreshContractors();
  }

  const verified = contractors.filter((c) => c.status === "verified");
  const pending = contractors.filter((c) => c.status !== "verified");

  return (
    <div className="stage-pad">
      <div className="page-top">
        <div>
          <h1>People</h1>
          <p>
            {verified.length} verified
            {pending.length ? ` · ${pending.length} pending` : ""}
          </p>
        </div>
        <button className="btn primary" onClick={() => setShowModal(true)}>
          <Icon name="plus" size={14} />Invite
        </button>
      </div>

      {banner && (
        <div className="banner">
          <Icon name="check" size={16} />
          <div className="txt">
            Verification link ready for <strong>{banner.name}</strong>
            <code>{banner.url}</code>
          </div>
          <button
            className="btn sm subtle"
            onClick={() => {
              navigator.clipboard?.writeText(banner.url);
              onToast("Link copied");
            }}
          >
            Copy
          </button>
          <button
            className="x"
            onClick={() => setBanner(null)}
            aria-label="Dismiss"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {verified.length > 0 && (
        <>
          <div className="section-title">
            <span>Verified</span>
            <span className="link">{verified.length}</span>
          </div>
          <div className="contractor-list">
            {verified.map((c) => (
              <ContractorRow
                key={c.id}
                contractor={c}
                onSelect={() => setSelected(c)}
              />
            ))}
          </div>
        </>
      )}

      {pending.length > 0 && (
        <>
          <div className="section-title">
            <span>Pending verification</span>
            <span className="link">{pending.length}</span>
          </div>
          <div className="contractor-list">
            {pending.map((c) => (
              <ContractorRow
                key={c.id}
                contractor={c}
                onSelect={() => setSelected(c)}
              />
            ))}
          </div>
        </>
      )}

      {contractors.length === 0 && (
        <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>
            No contractors yet. Invite your first to get started.
          </div>
        </div>
      )}

      {selected && (
        <ContractorDrawer
          contractor={selected}
          onClose={() => setSelected(null)}
          onToast={onToast}
        />
      )}

      {showModal && (
        <InviteModal
          onClose={() => setShowModal(false)}
          onInvited={handleInvited}
        />
      )}
    </div>
  );
}
