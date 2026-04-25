export type ContractorStatus = "verified" | "pending" | "unverified";

export interface Contractor {
  id: string;
  name: string;
  email: string;
  country: string;
  wallet_address: string;
  status: ContractorStatus;
  didit_session_id: string;
  kyc_provider?: string;
  verified_at: string | null;
  created_at: string;
  paid_total_eur?: number;
  payments_count?: number;
}

export interface InviteResponse {
  contractor_id: string;
  verification_url: string;
  status: "pending";
}

export type TimelineEventType =
  | "intent_parsed"
  | "contractor_resolved"
  | "balance_checked"
  | "fx_quoted"
  | "compliance_screened"
  | "onchain_executing"
  | "onchain_confirmed"
  | "receipt_ready";

export interface TimelineEvent {
  type: TimelineEventType;
  payload: Record<string, unknown>;
}

export type PaymentStatus = "pending" | "settled" | "failed";

export interface Payment {
  id: string;
  contractor_id: string;
  contractor_name: string | null;
  contractor_country: string | null;
  amount: number;
  currency: string;
  settlement_amount: number;
  settlement_token: string;
  fx_rate: number;
  memo: string;
  tx_hash: string;
  block_number: number | null;
  block_explorer_url: string;
  status: PaymentStatus;
  created_at: string;
  settled_at: string | null;
}

export interface PaymentEvent {
  id: number;
  payment_id: string;
  type: TimelineEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface PaymentDetail extends Omit<Payment, "contractor_name" | "contractor_country"> {
  contractor: Contractor | null;
  events: PaymentEvent[];
}
