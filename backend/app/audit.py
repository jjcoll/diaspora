import hashlib
import json
import os
from datetime import datetime, timezone

from .bunq import CTX
from .config import AUDIT_DIR


def generate_audit_packet(data: dict) -> dict:
    receipt = {
        "version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "payer": {
            "bunq_account_id": CTX["account_id"],
            "kyc_status": "VERIFIED",
            "balance_at_execution": data.get("balance"),
        },
        "recipient": {
            "name": data.get("recipient_name"),
            "country": data.get("country"),
            "wallet": data.get("wallet"),
            "invoice_ref": data.get("invoice_ref"),
        },
        "compliance": {
            "aml_session_id": data.get("aml_session_id"),
            "risk_score": data.get("risk_score", "LOW"),
            "screened_at": data.get("screened_at"),
        },
        "payment": {
            "eur_amount": data.get("eur_amount"),
            "fx_rate": data.get("fx_rate"),
            "fx_source": data.get("fx_source"),
            "fee_eur": data.get("fee_eur"),
            "bunq_payment_id": data.get("bunq_payment_id"),
            "reference_id": data.get("reference_id"),
            "consent_timestamp": data.get("consent_timestamp"),
        },
        "settlement": {
            "usdc_amount": data.get("usdc_amount"),
            "tx_hash": data.get("tx_hash"),
            "block_number": data.get("block_number"),
            "network": "base-sepolia",
            "off_ramp_reference_id": data.get("reference_id"),
            "explorer_url": data.get("explorer_url"),
        },
    }
    receipt_str = json.dumps(receipt, sort_keys=True)
    receipt["receipt_hash"] = hashlib.sha256(receipt_str.encode()).hexdigest()

    filename = os.path.join(
        AUDIT_DIR, f"audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    with open(filename, "w") as f:
        json.dump(receipt, f, indent=2)

    print(f"\nAudit packet: {filename}")
    print(f"   SHA-256: {receipt['receipt_hash'][:16]}...")
    return {"file": filename, "receipt_hash": receipt["receipt_hash"]}
