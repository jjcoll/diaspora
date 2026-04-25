"""
Stub implementations — replace with real integrations.

aml_screen               → Didit API
generate_fx_quote        → live FX feed
stub_sepa_payment        → real bunq SEPA call to bridge.xyz off-ramp IBAN
simulate_usdc_settlement → Bridge / BVNK off-ramp
"""
import os
import time
import uuid
from datetime import datetime, timezone

from . import config  # noqa: F401  (loads .env)


def aml_screen(wallet_address: str, country: str) -> dict:
    return {
        "cleared": True,
        "risk_score": "LOW",
        "session_id": f"stub-{uuid.uuid4().hex[:12]}",
        "screened_at": datetime.now(timezone.utc).isoformat(),
        "wallet": wallet_address,
        "country": country,
    }


def generate_fx_quote(eur_amount: float) -> dict:
    fx_rate = 1.08
    usdc_amount = round(eur_amount * fx_rate, 2)
    fee_eur = round(eur_amount * 0.004, 2)
    return {
        "eur_amount": eur_amount,
        "usdc_amount": usdc_amount,
        "fx_rate": fx_rate,
        "fx_source": "stub-hardcoded",
        "fee_eur": fee_eur,
        "gas_usd": 0.02,
        "eta": "~20 seconds",
        "quoted_at": datetime.now(timezone.utc).isoformat(),
    }


def stub_sepa_payment(eur_amount: float, recipient_name: str, reference_id: str) -> dict:
    return {
        "payment_id": f"stub-{uuid.uuid4().hex[:12]}",
        "reference_id": reference_id,
        "status": "EXECUTED",
        "eur_amount": eur_amount,
        "recipient_name": recipient_name,
    }


def simulate_usdc_settlement(reference_id: str, usdc_amount: float) -> dict:
    print("   Routing to off-ramp partner...")
    time.sleep(3)
    tx_hash = os.getenv("FAKE_TX_HASH")
    block = os.getenv("FAKE_BLOCK_NUMBER")
    return {
        "tx_hash": tx_hash,
        "block_number": block,
        "network": "base-sepolia",
        "usdc_amount_settled": usdc_amount,
        "confirmation_timestamp": datetime.now(timezone.utc).isoformat(),
        "explorer_url": f"https://sepolia.basescan.org/tx/{tx_hash}",
        "off_ramp_reference_id": reference_id,
    }
