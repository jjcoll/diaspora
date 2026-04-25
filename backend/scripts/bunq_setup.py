#!/usr/bin/env python3
"""
Run once: python scripts/bunq_setup.py
Saves session token + user/account IDs to backend/bunq_context.json
"""
import os
import json
from datetime import datetime, timezone

import httpx
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from dotenv import load_dotenv

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BACKEND_DIR, ".env")
CTX_PATH = os.path.join(BACKEND_DIR, "bunq_context.json")
load_dotenv(dotenv_path=ENV_PATH)

BASE_URL = "https://public-api.sandbox.bunq.com/v1"
API_KEY = os.getenv("BUNQ_API_KEY")

if not API_KEY:
    raise SystemExit("BUNQ_API_KEY not set in .env")

COMMON_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "diaspora-demo/1.0",
    "X-Bunq-Language": "en_US",
    "X-Bunq-Region": "nl_NL",
    "X-Bunq-Geolocation": "0 0 0 0 NL",
    "Cache-Control": "no-cache",
}


def make_request_id() -> str:
    return f"diaspora-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"


# ── 1. Generate RSA key pair ───────────────────────────────────────────────
print("1. Generating RSA key pair...")
private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
public_key = private_key.public_key()

private_pem = private_key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
).decode()

public_pem = public_key.public_bytes(
    serialization.Encoding.PEM,
    serialization.PublicFormat.SubjectPublicKeyInfo,
).decode()

# ── 2. POST /installation ──────────────────────────────────────────────────
print("2. Creating installation...")
r = httpx.post(
    f"{BASE_URL}/installation",
    headers={**COMMON_HEADERS, "X-Bunq-Client-Request-Id": make_request_id()},
    json={"client_public_key": public_pem},
)
r.raise_for_status()
resp = r.json()["Response"]
installation_token = next(x["Token"]["token"] for x in resp if "Token" in x)
print(f"   ✅ Installation token: {installation_token[:20]}...")

# ── 3. POST /device-server ─────────────────────────────────────────────────
print("3. Registering device...")
r = httpx.post(
    f"{BASE_URL}/device-server",
    headers={
        **COMMON_HEADERS,
        "X-Bunq-Client-Authentication": installation_token,
        "X-Bunq-Client-Request-Id": make_request_id(),
    },
    json={
        "description": "diaspora-demo",
        "secret": API_KEY,
        "permitted_ips": ["*"],
    },
)
r.raise_for_status()
print(f"   ✅ Device registered")

# ── 4. POST /session-server ────────────────────────────────────────────────
print("4. Opening session...")
r = httpx.post(
    f"{BASE_URL}/session-server",
    headers={
        **COMMON_HEADERS,
        "X-Bunq-Client-Authentication": installation_token,
        "X-Bunq-Client-Request-Id": make_request_id(),
    },
    json={"secret": API_KEY},
)
r.raise_for_status()
resp = r.json()["Response"]
session_token = next(x["Token"]["token"] for x in resp if "Token" in x)
user_id = next(
    (x.get("UserPerson") or x.get("UserCompany") or {}).get("id")
    for x in resp
    if "UserPerson" in x or "UserCompany" in x
)
print(f"   ✅ Session token: {session_token[:20]}...")
print(f"   ✅ User ID: {user_id}")

# ── 5. GET monetary accounts ───────────────────────────────────────────────
print("5. Fetching monetary accounts...")
r = httpx.get(
    f"{BASE_URL}/user/{user_id}/monetary-account",
    headers={
        **COMMON_HEADERS,
        "X-Bunq-Client-Authentication": session_token,
        "X-Bunq-Client-Request-Id": make_request_id(),
    },
)
r.raise_for_status()
accounts = r.json()["Response"]
account_id = None
for a in accounts:
    acc = a.get("MonetaryAccountBank") or a.get("MonetaryAccount")
    if acc:
        account_id = acc["id"]
        balance = acc["balance"]["value"]
        currency = acc["balance"]["currency"]
        print(f"   ✅ Account ID: {account_id}  |  Balance: {currency} {balance}")
        break

# ── 6. Save context ────────────────────────────────────────────────────────
ctx = {
    "session_token": session_token,
    "user_id": user_id,
    "account_id": account_id,
    "private_key_pem": private_pem,
    "created_at": datetime.now(timezone.utc).isoformat(),
}
with open(CTX_PATH, "w") as f:
    json.dump(ctx, f, indent=2)

print(f"\n✅ Done! Context saved to {CTX_PATH}")
print("   Add to .env:")
print(f"   BUNQ_USER_ID={user_id}")
print(f"   BUNQ_ACCOUNT_ID={account_id}")
