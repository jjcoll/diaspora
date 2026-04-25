import Icon from "./Icon";

export type Tab = "payments" | "contractors";

interface Props {
  tab: Tab;
  setTab: (tab: Tab) => void;
}

export default function TabBar({ tab, setTab }: Props) {
  return (
    <nav className="tabbar">
      <div className="tabbar-inner">
        <div className="desktop-brand only-desktop">
          <div className="mark mark-logo" role="img" aria-label="diaspora" />
          <div className="word">diaspora</div>
        </div>
        <button
          className={`tab ${tab === "payments" ? "active" : ""}`}
          onClick={() => setTab("payments")}
        >
          <Icon name="dollar" size={22} />
          <span>Pay</span>
        </button>
        <button
          className={`tab ${tab === "contractors" ? "active" : ""}`}
          onClick={() => setTab("contractors")}
        >
          <Icon name="users" size={22} />
          <span>People</span>
        </button>
        <div className="tabbar-footer only-desktop">
          <div className="avatar">AK</div>
          <div style={{ minWidth: 0 }}>
            <div className="nm">Aisha Karim</div>
            <div className="org">Atlas Labs</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
