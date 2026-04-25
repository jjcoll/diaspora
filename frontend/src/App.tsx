import { useState } from "react";
import TabBar, { type Tab } from "./components/TabBar";
import TopHeader from "./components/TopHeader";
import ContractorsTab from "./tabs/ContractorsTab";
import PaymentsTab from "./tabs/PaymentsTab";
import { useToast } from "./lib/toast";
import type { Contractor } from "./types";

export default function App() {
  const [tab, setTab] = useState<Tab>("payments");
  const [contractors] = useState<Contractor[]>([]);
  const { show, node: toastNode } = useToast();

  return (
    <div className="app">
      <TabBar tab={tab} setTab={setTab} />

      <div className="stage">
        <TopHeader tab={tab} />

        {tab === "payments" ? (
          <PaymentsTab />
        ) : (
          <ContractorsTab contractors={contractors} onToast={show} />
        )}
      </div>

      {toastNode}
    </div>
  );
}
