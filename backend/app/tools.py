import json
import unicodedata
from datetime import datetime, timezone

from .audit import generate_audit_packet
from .bunq import get_balance
from .config import CONTACTS_PATH
from .stubs import (
    aml_screen,
    generate_fx_quote,
    simulate_usdc_settlement,
    stub_sepa_payment,
)

with open(CONTACTS_PATH) as f:
    CONTACTS = json.load(f)


def _normalize(s: str) -> str:
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


def list_contractors() -> dict:
    return {
        "count": len(CONTACTS),
        "contractors": [
            {"name": v["name"], "country": v["country"], "currency": v["currency"]}
            for v in CONTACTS.values()
        ],
    }


def resolve_contractor(name: str) -> dict:
    key = _normalize(name.split()[0])
    for k, v in CONTACTS.items():
        if _normalize(k) == key or _normalize(v["name"].split()[0]) == key:
            return {"found": True, **v}
    return {"found": False, "name": name}


def execute_sepa_payment(eur_amount: float, recipient_name: str, reference_id: str) -> dict:
    # Stubbed for now — bridge.xyz off-ramp IBAN wiring lands later.
    return stub_sepa_payment(eur_amount, recipient_name, reference_id)


TOOLS = [
    {
        "name": "list_contractors",
        "description": "List all contractors saved in the user's contact book. Use this when the user asks 'who can I pay?', 'show my contacts', or similar.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "resolve_contractor",
        "description": "Look up a contractor by name from the user's saved contacts",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Contractor first name or full name"}
            },
            "required": ["name"],
        },
    },
    {
        "name": "check_balance",
        "description": "Check the user's current bunq EUR balance",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "aml_screen",
        "description": "Screen a wallet address for AML/sanctions risk",
        "input_schema": {
            "type": "object",
            "properties": {
                "wallet_address": {"type": "string"},
                "country": {"type": "string", "description": "ISO-2 country code"},
            },
            "required": ["wallet_address", "country"],
        },
    },
    {
        "name": "generate_fx_quote",
        "description": "Generate a transparent FX quote: EUR amount in, USDC amount out, fee, ETA",
        "input_schema": {
            "type": "object",
            "properties": {"eur_amount": {"type": "number"}},
            "required": ["eur_amount"],
        },
    },
    {
        "name": "execute_sepa_payment",
        "description": "Execute the SEPA payment via bunq. Only call after the user has explicitly confirmed with 'yes'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "eur_amount": {"type": "number"},
                "recipient_name": {"type": "string"},
            },
            "required": ["eur_amount", "recipient_name"],
        },
    },
]


SYSTEM = """You are diaspora, a terminal payment agent on bunq.

Style: terse. Plain text. No markdown, no emojis, no bold. No follow-up suggestions or examples unless asked. Answer the question, stop.

Listing contacts: just the names + country + currency, one per line. Nothing else.

Payment flow (only when user asks to pay someone):
1. resolve_contractor — find the recipient
2. check_balance — confirm funds
3. aml_screen — screen the wallet
4. generate_fx_quote — cost breakdown
5. After fx quote: write EXACTLY one line: "Confirm payment?" — do NOT include any amounts, recipient, or quote details. The UI renders the quote card itself.
6. Call execute_sepa_payment ONLY after explicit "yes"
7. After execute_sepa_payment: write EXACTLY "Done." — nothing else. The UI renders the receipt itself."""


def run_tool(name: str, inputs: dict, state: dict) -> dict:
    if name == "list_contractors":
        return list_contractors()

    if name == "resolve_contractor":
        result = resolve_contractor(**inputs)
        if result.get("found"):
            state.update({
                "recipient_name": result["name"],
                "wallet": result["wallet"],
                "country": result["country"],
                "invoice_ref": result["invoice_ref"],
            })
        return result

    if name == "check_balance":
        result = get_balance()
        state["balance"] = result["balance"]
        return result

    if name == "aml_screen":
        result = aml_screen(**inputs)
        state.update({
            "aml_session_id": result["session_id"],
            "risk_score": result["risk_score"],
            "screened_at": result["screened_at"],
        })
        return result

    if name == "generate_fx_quote":
        result = generate_fx_quote(**inputs)
        state.update({
            "eur_amount": result["eur_amount"],
            "usdc_amount": result["usdc_amount"],
            "fx_rate": result["fx_rate"],
            "fx_source": result["fx_source"],
            "fee_eur": result["fee_eur"],
        })
        return result

    if name == "execute_sepa_payment":
        if not state.get("user_confirmed"):
            return {"error": "Payment blocked — user has not confirmed yet."}
        ref_id = f"DIASPORA-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        inputs["reference_id"] = ref_id
        result = execute_sepa_payment(**inputs)
        state.update({
            "bunq_payment_id": result["payment_id"],
            "reference_id": result["reference_id"],
            "consent_timestamp": datetime.now(timezone.utc).isoformat(),
        })

        settlement = simulate_usdc_settlement(ref_id, state.get("usdc_amount", 0))
        state.update({
            "tx_hash": settlement["tx_hash"],
            "block_number": settlement["block_number"],
            "explorer_url": settlement["explorer_url"],
        })
        print(f"\nOn-chain settlement: {settlement['explorer_url']}")

        audit = generate_audit_packet(state)
        return {**result, "settlement": settlement, "audit": audit}

    return {"error": f"unknown tool: {name}"}
