#!/usr/bin/env python3
"""Verify sandbox connection and top up with test money."""
import json
import os
from datetime import datetime, timezone
import httpx

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CTX_PATH = os.path.join(BACKEND_DIR, "bunq_context.json")

BASE_URL = "https://public-api.sandbox.bunq.com/v1"
with open(CTX_PATH) as f:
    ctx = json.load(f)


def headers(rid=None):
    return {
        "Content-Type": "application/json",
        "User-Agent": "diaspora-demo/1.0",
        "X-Bunq-Language": "en_US",
        "X-Bunq-Region": "nl_NL",
        "X-Bunq-Geolocation": "0 0 0 0 NL",
        "Cache-Control": "no-cache",
        "X-Bunq-Client-Authentication": ctx["session_token"],
        "X-Bunq-Client-Request-Id": rid or f"diaspora-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
    }


user_id = ctx["user_id"]
account_id = ctx["account_id"]

# ── 1. Check balance ───────────────────────────────────────────────────────
print("1. Checking balance...")
r = httpx.get(f"{BASE_URL}/user/{user_id}/monetary-account/{account_id}", headers=headers())
r.raise_for_status()
acc = r.json()["Response"][0]
acc_data = acc.get("MonetaryAccountBank") or acc.get("MonetaryAccount")
balance = acc_data["balance"]
print(f"   Balance: {balance['currency']} {balance['value']}")

# ── 2. Top up via sandbox sugar daddy ─────────────────────────────────────
print("2. Requesting test funds from sandbox sugar daddy...")
r = httpx.post(
    f"{BASE_URL}/user/{user_id}/monetary-account/{account_id}/request-inquiry",
    headers=headers(),
    json={
        "amount_inquired": {"value": "1000.00", "currency": "EUR"},
        "counterparty_alias": {
            "type": "EMAIL",
            "value": "sugardaddy@bunq.com",
        },
        "description": "test funds",
        "allow_bunqme": False,
    },
)
print(f"   Status: {r.status_code}")
print(f"   Response: {r.text[:300]}")

# ── 3. Check balance again ─────────────────────────────────────────────────
print("3. Checking balance after top-up...")
r = httpx.get(f"{BASE_URL}/user/{user_id}/monetary-account/{account_id}", headers=headers())
r.raise_for_status()
acc = r.json()["Response"][0]
acc_data = acc.get("MonetaryAccountBank") or acc.get("MonetaryAccount")
balance = acc_data["balance"]
print(f"   Balance: {balance['currency']} {balance['value']}")
