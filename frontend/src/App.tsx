import { useEffect, useState } from "react";
import TabBar, { type Tab } from "./components/TabBar";
import TopHeader from "./components/TopHeader";
import ContractorsTab from "./tabs/ContractorsTab";
import PaymentsTab from "./tabs/PaymentsTab";
import { useToast } from "./lib/toast";
import { listContractors } from "./api";
import type { Contractor } from "./types";

export default function App() {
  const [tab, setTab] = useState<Tab>("payments");
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const { show, node: toastNode } = useToast();

  useEffect(() => {
    listContractors()
      .then(setContractors)
      .catch((err) => show(`failed to load contacts: ${err.message}`));
  }, [show]);

  return (
    <div className="app" data-tab={tab}>
      <TabBar tab={tab} setTab={setTab} />

      <div className="stage">
        <TopHeader tab={tab} />

        <div className="tab-panel" hidden={tab !== "payments"}>
          <PaymentsTab active={tab === "payments"} />
        </div>
        <div className="tab-panel" hidden={tab !== "contractors"}>
          <ContractorsTab contractors={contractors} onToast={show} />
        </div>
      </div>

      {toastNode}
    </div>
  );
}
