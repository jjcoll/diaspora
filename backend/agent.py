import os, json, hashlib, base64
from datetime import datetime, timezone
from anthropic import Anthropic
from dotenv import load_dotenv
import httpx
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding as apad
from stubs import aml_screen, generate_fx_quote, simulate_usdc_settlement

_env = {}
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=_env_path, override=True)
from dotenv import dotenv_values as _dv
_env = _dv(_env_path)

client = Anthropic(api_key=_env.get("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY"))
CONTACTS = json.load(open("contacts.json"))
CTX = json.load(open("bunq_context.json"))
BUNQ_BASE = "https://public-api.sandbox.bunq.com/v1"

_private_key = serialization.load_pem_private_key(CTX["private_key_pem"].encode(), password=None)

# ── bunq helpers ───────────────────────────────────────────────────────────

def _rid() -> str:
    return f"diaspora-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"

def _sign(body: str) -> str:
    return base64.b64encode(
        _private_key.sign(body.encode(), apad.PKCS1v15(), hashes.SHA256())
    ).decode()

def _headers(body: str = "") -> dict:
    h = {
        "Content-Type": "application/json",
        "User-Agent": "diaspora-demo/1.0",
        "X-Bunq-Language": "en_US",
        "X-Bunq-Region": "nl_NL",
        "X-Bunq-Geolocation": "0 0 0 0 NL",
        "Cache-Control": "no-cache",
        "X-Bunq-Client-Authentication": CTX["session_token"],
        "X-Bunq-Client-Request-Id": _rid(),
    }
    if body:
        h["X-Bunq-Client-Signature"] = _sign(body)
    return h

# ── tools ──────────────────────────────────────────────────────────────────

def resolve_contractor(name: str) -> dict:
    import unicodedata
    def normalize(s):
        return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    key = normalize(name.split()[0])
    for k, v in CONTACTS.items():
        if normalize(k) == key or normalize(v["name"].split()[0]) == key:
            return {"found": True, **v}
    return {"found": False, "name": name}


def check_balance() -> dict:
    uid, aid = CTX["user_id"], CTX["account_id"]
    r = httpx.get(
        f"{BUNQ_BASE}/user/{uid}/monetary-account/{aid}",
        headers=_headers(),
    )
    r.raise_for_status()
    acc = r.json()["Response"][0]
    acc_data = acc.get("MonetaryAccountBank") or acc.get("MonetaryAccount")
    bal = acc_data["balance"]
    return {"balance": float(bal["value"]), "currency": bal["currency"]}


def execute_sepa_payment(eur_amount: float, recipient_name: str, reference_id: str) -> dict:
    uid, aid = CTX["user_id"], CTX["account_id"]
    body = json.dumps({
        "amount": {"value": f"{eur_amount:.2f}", "currency": "EUR"},
        "counterparty_alias": {
            "type": "IBAN",
            "value": "NL02ABNA0123456789",
            "name": recipient_name,
        },
        "description": reference_id,
    })
    r = httpx.post(
        f"{BUNQ_BASE}/user/{uid}/monetary-account/{aid}/payment",
        headers=_headers(body),
        content=body,
    )
    if not r.is_success:
        raise RuntimeError(f"bunq payment failed {r.status_code}: {r.text}")
    payment_id = r.json()["Response"][0]["Id"]["id"]
    return {"payment_id": payment_id, "reference_id": reference_id, "status": "EXECUTED"}


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

    filename = f"audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, "w") as f:
        json.dump(receipt, f, indent=2)

    print(f"\n📄 Audit packet: {filename}")
    print(f"   SHA-256: {receipt['receipt_hash'][:16]}...")
    return {"file": filename, "receipt_hash": receipt["receipt_hash"]}


# ── tool schemas ───────────────────────────────────────────────────────────

TOOLS = [
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
            "properties": {
                "eur_amount": {"type": "number"}
            },
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

SYSTEM = """You are diaspora, an AI payment agent built on bunq.

When a user asks to pay someone, follow these steps in order:
1. resolve_contractor — find the recipient
2. check_balance — confirm funds are available
3. aml_screen — screen the recipient's wallet
4. generate_fx_quote — show the full cost breakdown
5. Present the quote clearly and ask: "Do you confirm this payment? (yes/no)"
6. ONLY call execute_sepa_payment after the user explicitly says yes

Quote format:
  Recipient: <name> · <country> · <invoice_ref>
  ────────────────────────────────────────
  You send:   €<amount> EUR
  They get:   <usdc> USDC
  Rate:       1 EUR = <rate> USDC
  Fee:        €<fee> (0.4%)
  Gas:        $<gas>
  ETA:        ~20 seconds

  AML: ✅ Cleared  |  Balance: ✅ Sufficient

  Do you confirm this payment? (yes/no)

After payment executes, tell the user the bunq payment ID and that settlement is routing."""


# ── agent loop ─────────────────────────────────────────────────────────────

def run_tool(name: str, inputs: dict, state: dict) -> dict:
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
        result = check_balance()
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

        # Fire settlement immediately after SEPA
        settlement = simulate_usdc_settlement(ref_id, state.get("usdc_amount", 0))
        state.update({
            "tx_hash": settlement["tx_hash"],
            "block_number": settlement["block_number"],
            "explorer_url": settlement["explorer_url"],
        })
        print(f"\n✅ On-chain settlement: {settlement['explorer_url']}")

        # Generate audit packet
        generate_audit_packet(state)
        return {**result, "settlement": settlement}

    return {"error": f"unknown tool: {name}"}


def run_agent(user_message: str):
    print(f"\n💬 You: {user_message}\n")
    messages = [{"role": "user", "content": user_message}]
    state = {}

    while True:
        resp = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            system=SYSTEM,
            tools=TOOLS,
            messages=messages,
        )

        for block in resp.content:
            if block.type == "text" and block.text:
                print(f"🤖 diaspora: {block.text}")

        if resp.stop_reason == "end_turn":
            # Check if agent is waiting for user input
            try:
                user_input = input("\n> ").strip().lower()
            except EOFError:
                break
            if "yes" in user_input or user_input == "y":
                state["user_confirmed"] = True
                messages.append({"role": "assistant", "content": resp.content})
                messages.append({"role": "user", "content": "yes, confirmed"})
                continue
            else:
                print("Payment cancelled.")
                break

        if resp.stop_reason != "tool_use":
            break

        tool_results = []
        for block in resp.content:
            if block.type == "tool_use":
                print(f"   🔧 {block.name}({json.dumps(block.input)})")
                result = run_tool(block.name, block.input, state)
                print(f"   ✅ {json.dumps(result)}")
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                })

        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user", "content": tool_results})


if __name__ == "__main__":
    run_agent("Pay José €500 for the October invoice")
