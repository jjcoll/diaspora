import { useCallback, useEffect, useState } from "react";
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

  const refresh = useCallback(() => {
    listContractors().then(setContractors).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="app">
      <TabBar tab={tab} setTab={setTab} />

      <div className="stage">
        <TopHeader tab={tab} />

        {tab === "payments" ? (
          <PaymentsTab
            contractors={contractors}
            onToast={show}
            refreshContractors={refresh}
          />
        ) : (
          <ContractorsTab
            contractors={contractors}
            setContractors={setContractors}
            onToast={show}
            refreshContractors={refresh}
          />
        )}
      </div>

      {toastNode}
    </div>
  );
}
