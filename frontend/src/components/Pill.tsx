import Icon from "./Icon";
import type { ReactNode } from "react";

type PillKind = "verified" | "pending" | "unverified" | "attention";

export function Pill({ kind, children }: { kind: PillKind; children: ReactNode }) {
  const showDot = kind !== "unverified";
  return (
    <span className={`pill ${kind}`}>
      {showDot && <span className="dot" />}
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  if (status === "verified") {
    return <Pill kind="verified"><Icon name="check" size={10} />Verified</Pill>;
  }
  if (status === "pending") {
    return <Pill kind="pending">Pending KYC</Pill>;
  }
  return <Pill kind="unverified">Unverified</Pill>;
}

export function PaymentStatusPill({ status }: { status: string }) {
  if (status === "settled") {
    return <Pill kind="verified"><Icon name="check" size={10} />Settled</Pill>;
  }
  if (status === "pending") {
    return <Pill kind="pending">Pending</Pill>;
  }
  if (status === "failed") {
    return <Pill kind="attention">Failed</Pill>;
  }
  return <Pill kind="unverified">{status}</Pill>;
}
