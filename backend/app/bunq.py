import base64
import json
from datetime import datetime, timezone

import httpx
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding as apad

from .config import CTX_PATH

BUNQ_BASE = "https://public-api.sandbox.bunq.com/v1"

with open(CTX_PATH) as f:
    CTX = json.load(f)

_private_key = serialization.load_pem_private_key(
    CTX["private_key_pem"].encode(), password=None
)


def rid() -> str:
    return f"diaspora-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"


def sign(body: str) -> str:
    return base64.b64encode(
        _private_key.sign(body.encode(), apad.PKCS1v15(), hashes.SHA256())
    ).decode()


def headers(body: str = "") -> dict:
    h = {
        "Content-Type": "application/json",
        "User-Agent": "diaspora-demo/1.0",
        "X-Bunq-Language": "en_US",
        "X-Bunq-Region": "nl_NL",
        "X-Bunq-Geolocation": "0 0 0 0 NL",
        "Cache-Control": "no-cache",
        "X-Bunq-Client-Authentication": CTX["session_token"],
        "X-Bunq-Client-Request-Id": rid(),
    }
    if body:
        h["X-Bunq-Client-Signature"] = sign(body)
    return h


def get_balance() -> dict:
    uid, aid = CTX["user_id"], CTX["account_id"]
    r = httpx.get(
        f"{BUNQ_BASE}/user/{uid}/monetary-account/{aid}",
        headers=headers(),
    )
    r.raise_for_status()
    acc = r.json()["Response"][0]
    acc_data = acc.get("MonetaryAccountBank") or acc.get("MonetaryAccount")
    bal = acc_data["balance"]
    return {"balance": float(bal["value"]), "currency": bal["currency"]}
