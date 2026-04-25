interface Props {
  tab: "payments" | "contractors";
}

export default function TopHeader({ tab }: Props) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="head">
      <div className="greeting">
        {greeting}, Aisha
        <small>
          {tab === "payments" ? "Ready when you are." : "Your verified payees."}
        </small>
      </div>
    </div>
  );
}
