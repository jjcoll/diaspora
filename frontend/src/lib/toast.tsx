import { useCallback, useState } from "react";
import Icon from "../components/Icon";

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);

  const show = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  }, []);

  const node = toast ? (
    <div className="toast">
      <Icon name="check" size={13} />
      {toast}
    </div>
  ) : null;

  return { show, node };
}
