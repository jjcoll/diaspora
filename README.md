# Diaspora

An AI agent inside bunq that executes compliant cross-border payments using stablecoins as invisible rails — turning 5-day transfers into 20-second, fully auditable transactions.

## The Problem

Paying a freelancer in Venezuela or Nigeria from bunq today means a 5-day wait, 7% in fees, and zero visibility into where the money is.

## The Solution

An AI agent that lives in bunq and routes those payments through stablecoin rails instead. You tell it *"pay José €500"* in plain language — it resolves the contractor, checks your balance, quotes the FX transparently, screens for compliance, executes on-chain, and hands you a block-explorer receipt in under 20 seconds.

Transparent rails for the people traditional banking rails don't serve.

## What Makes a Transaction Legit

Every payment the agent executes carries the evidence needed to stand up to an auditor, a regulator, and a bookkeeper. Grouped into five buckets:

### Identity — *"we know who sent and who received"*
1. Verified sender (bunq KYC)
2. Verified recipient (contractor onboarding)
3. Recipient wallet attestation

### Consent & Intent — *"the user explicitly approved this payment for this reason"*
4. Explicit user approval of the specific payment
5. Stated purpose / memo captured at approval time

### Compliance — *"we screened and documented it"*
6. Sanctions and PEP screening, with the screening result archived alongside the transaction

### Execution Proof — *"here it is, on a public blockchain, forever"*
7. On-chain transaction hash
8. Block explorer link
9. Confirmed settlement amount and token
10. Timestamp from the chain itself

### Accounting — *"here's what your bookkeeper needs"*
11. FX rate used, with source
12. Fee breakdown
13. Original invoice / reference
14. Exportable receipt (PDF + JSON)
15. Matching ledger entry

## Repo Layout

```
diaspora/
├── backend/
│   ├── app/
│   │   ├── agent.py        # REPL + Claude tool loop (entry point)
│   │   ├── tools.py        # tool defs: list/resolve_contractor, balance, fx, sepa
│   │   ├── bunq.py         # bunq HTTP helpers (RSA signing, headers, balance)
│   │   ├── audit.py        # generate_audit_packet (JSON + SHA-256)
│   │   ├── stubs.py        # stub impls (AML, FX, SEPA, USDC settlement)
│   │   └── config.py       # paths, env loading, preflight
│   ├── scripts/
│   │   ├── bunq_setup.py    # one-time bunq sandbox auth handshake
│   │   ├── bunq_test.py     # connectivity + sugar daddy top-up test
│   │   ├── sepolia_setup.py # wallet gen + Base Sepolia USDC self-transfer
│   │   └── web3_test.py     # Base Sepolia connectivity + tx verification
│   ├── data/
│   │   └── contacts.json   # contractor contact book
│   ├── audit_packets/      # generated audit JSONs (gitignored)
│   ├── bunq_context.json   # session token + RSA key (gitignored)
│   ├── requirements.txt
│   └── .env.example
├── frontend/               # React + timeline UI (TBD)
├── README.md
└── .gitignore
```

## What's Built

### `agent.py` — the payment agent

Claude-powered agent that executes the full payment flow from a single plain-language instruction. Runs as a terminal app.

**Flow:**
1. `resolve_contractor` — looks up recipient from `contacts.json`
2. `check_balance` — real bunq sandbox API call with RSA signing
3. `aml_screen` — AML/sanctions screening (stub, replace with Didit)
4. `generate_fx_quote` — FX quote with fee breakdown (stub, replace with live feed)
5. Consent gate — waits for explicit user `yes` before any payment fires
6. `execute_sepa_payment` — real SEPA payment via bunq sandbox API
7. `simulate_usdc_settlement` — pre-baked Base Sepolia tx hash (stub, replace with Bridge/BVNK)
8. `generate_audit_packet` — JSON receipt with SHA-256 fingerprint

**Run:**
```bash
cd backend && .venv/bin/python -m app.agent
```

### `app/stubs.py` — colleague surface

Fake implementations clearly marked `# TODO: replace with real integration`:
- `aml_screen` → Didit API
- `generate_fx_quote` → live FX feed (ECB, Wise, etc.)
- `simulate_usdc_settlement` → Bridge / BVNK off-ramp webhook

### bunq sandbox setup

Full 4-step auth handshake: RSA key generation → `/installation` → `/device-server` → `/session-server`. Session token and private key saved to `bunq_context.json`. All payment calls signed with RSA-SHA256.

```bash
cd backend && .venv/bin/python scripts/bunq_setup.py
```

### Base Sepolia setup

Wallet generation + USDC contract verification against Base Sepolia (chain 84532). Pre-baked tx hash sourced from a real confirmed on-chain USDC transfer.

```bash
cd backend && .venv/bin/python scripts/sepolia_setup.py
```

## What's Real vs Stubbed

| Component | Status |
|---|---|
| bunq sandbox auth (RSA handshake) | ✅ real |
| bunq balance check | ✅ real API call |
| bunq SEPA payment execution | ✅ real API call |
| AML screening | 🔧 stub → replace with Didit |
| FX rate | 🔧 stub → hardcoded 1.08 |
| USDC off-ramp settlement | 🔧 stub → pre-baked Base Sepolia tx |
| Audit packet (JSON + SHA-256) | ✅ real |
| Base Sepolia RPC connection | ✅ real |

## Environment Setup

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                       # fill in BUNQ_API_KEY and ANTHROPIC_API_KEY
.venv/bin/python scripts/bunq_setup.py     # generates session token + bunq_context.json
.venv/bin/python scripts/sepolia_setup.py  # wallet + FAKE_TX_HASH (optional, for settlement display)
.venv/bin/python -m app.agent              # run the agent
```
