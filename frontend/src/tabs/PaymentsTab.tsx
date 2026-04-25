import { useState } from "react";
import Composer from "../components/Composer";

export default function PaymentsTab() {
  const [message, setMessage] = useState("");

  function handleSubmit(_msg: string) {
    // Wire up to backend later.
  }

  return (
    <div className="stage-pad">
      <div className="composer-dock">
        <Composer
          message={message}
          setMessage={setMessage}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
