import { useState } from "react";
import ContractorRow from "../components/ContractorRow";
import ContractorDrawer from "../components/ContractorDrawer";
import InviteModal, { type InviteForm } from "../components/InviteModal";
import Icon from "../components/Icon";
import type { Contractor } from "../types";

interface Props {
  contractors: Contractor[];
  onToast: (msg: string) => void;
}

export default function ContractorsTab({ contractors, onToast }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Contractor | null>(null);

  function handleInvite(_form: InviteForm) {
    // Wire up to backend later.
    setShowModal(false);
    onToast("Invite sent");
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
          onSubmit={handleInvite}
        />
      )}
    </div>
  );
}
