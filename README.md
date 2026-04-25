# Diaspora

An AI agent inside bunq that executes compliant cross-border payments using stablecoins as invisible rails — turning 5-day transfers into 20-second, fully auditable transactions.

## The Problem

Paying a freelancer in Venezuela or Nigeria from a European bank account today means a 5-day wait, ~7% in fees, and zero visibility into where the money is. SEPA doesn't reach them. SWIFT does, badly. Stablecoins reach them in seconds — but no bank operator wants to touch the compliance, FX, and audit story themselves.

## The Solution

A bunq-resident AI agent that takes a plain-language instruction (*"pay José €500"*), routes it through stablecoin rails, and hands back a receipt that an auditor would sign off on — all in under 20 seconds.

The user sees a single conversational surface: voice or text in, a transparent quote card to approve, then a receipt with an on-chain transaction hash. The compliance, FX, settlement, and audit-packet generation happen invisibly in between.

## How the Agent Works

The backend runs Claude Sonnet 4.5 in a tool-use loop. The model receives a single instruction and orchestrates six tools to drive the payment flow. The system prompt enforces a strict sequence and a hard consent gate before any money moves.

### Tools

| Tool | Purpose | Backed by |
|---|---|---|
| `list_contractors` | Enumerate saved contacts | local `contacts.json` |
| `resolve_contractor` | Look up a contact by name | local `contacts.json` |
| `check_balance` | Fetch the user's EUR balance | bunq sandbox API (real) |
| `aml_screen` | Sanctions / PEP check on the recipient wallet | stub (Didit-shaped) |
| `generate_fx_quote` | EUR → USDC rate, fee, ETA | stub (hardcoded 1.08) |
| `execute_sepa_payment` | Fire the SEPA leg + on-chain settlement | stub (bunq + Bridge-shaped) |

### Consent gate

`execute_sepa_payment` is gated server-side. The model can call it whenever it wants, but `tools.py` rejects the call unless `state["user_confirmed"] == True`, which is only flipped when the frontend posts an explicit `"yes"` to `/api/chat`. The model cannot bypass this — even if it tries to skip the quote step, the call is refused.

### State machine

Each agent turn runs in a server-side thread. Events stream to the frontend via Server-Sent Events: `text`, `tool_use`, and `tool_result` blocks land on the UI as they happen. Per-session state (`messages[]`, `state{}`) is held in-memory keyed by `session_id`. State accumulates the data each tool returns — wallet, balance, AML session ID, FX rate, payment ID — so the final `execute_sepa_payment` call can hand a complete record to the audit packet generator without re-querying anything.

## Architecture

```
[browser]   React + Vite                         port 5173
   │
   │   POST /api/chat  { session_id, message }
   ▼   ────── SSE stream of agent events ──────
[server]    FastAPI                              port 8000
   │   ├── agent loop (Claude Sonnet 4.5, tool use)
   │   ├── tools.py    (6 tools, consent gate)
   │   ├── bunq.py     (RSA-signed sandbox calls)
   │   ├── stubs.py    (AML, FX, SEPA, USDC settlement)
   │   └── audit.py    (JSON packet + SHA-256)
   │
   ├──► bunq sandbox API     (balance: real | SEPA: stubbed)
   ├──► Anthropic API         (Claude Sonnet 4.5)
   └──► Base Sepolia RPC      (wallet/setup only; settlement uses pre-baked tx)
```

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/contractors` | Contact book + (synthetic) payment history |
| `POST` | `/api/chat` | SSE-streamed agent turn |

### Frontend flow

`PaymentsTab` → `Composer` (text or voice) → SSE-driven timeline that renders each step the agent runs → `QuoteCard` (suppresses the composer until the user clicks **Confirm**) → `ReceiptSummary` → `ReceiptModal` with a downloadable PDF receipt and a block-explorer link.

## Auditability

The whole point of routing through stablecoins is that the trail can be made better than a SWIFT MT103, not worse. Every executed payment writes a JSON packet to `audit_packets/` with five sections:

- **Payer** — bunq account ID, KYC status, balance at execution
- **Recipient** — name, country, wallet, invoice reference
- **Compliance** — AML session ID, risk score, screening timestamp
- **Payment** — EUR amount, FX rate + source, fee, bunq payment ID, consent timestamp
- **Settlement** — USDC amount, tx hash, block number, off-ramp reference, block-explorer URL

A SHA-256 of the canonicalised JSON (`sort_keys=True`) is appended as `receipt_hash` and surfaced in the frontend receipt footer. That hash is the deterministic fingerprint a regulator or accountant can pin against a stored copy years later — if a single field is altered, the hash no longer matches.

The packet is structured so an auditor gets identity, consent, screening, execution proof, and accounting from a single file without joining anything.

## What's Real vs Mocked

| Component | Status | Notes |
|---|---|---|
| bunq sandbox auth (RSA-2048 install/device/session handshake) | real | `scripts/bunq_setup.py` |
| bunq balance check (RSA-signed GET) | real | `app/bunq.py` |
| Anthropic tool-use loop | real | `app/agent.py` |
| Audit packet (JSON + SHA-256) | real | `app/audit.py` |
| AML screening | stub | drop-in shape for Didit |
| FX quote | stub | hardcoded 1.08, ECB/Wise drop-in |
| SEPA payment execution | stub | shape matches a bridge.xyz off-ramp IBAN call |
| USDC settlement | stub | returns a pre-baked Base Sepolia tx hash from setup |
| Voice input | stub | fixed transcript on a 1.2s delay (Whisper drop-in) |

Every stub lives in `app/stubs.py` and returns the exact shape the real API would. Swapping in a live integration is a single-file change.

## Run It

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                              # BUNQ_API_KEY, ANTHROPIC_API_KEY
.venv/bin/python scripts/bunq_setup.py            # RSA handshake → bunq_context.json
.venv/bin/python scripts/sepolia_setup.py         # wallet + FAKE_TX_HASH for settlement
.venv/bin/uvicorn app.server:app --reload         # API on :8000
```

```bash
cd frontend
npm install
npm run dev                                       # UI on :5173
```

## Known Limitations

- Voice input ships a fixed transcript for the demo — wire Whisper or Deepgram for real STT.
- AML, FX, SEPA execution, and USDC settlement are stubs with the right shape but no upstream calls.
- Sessions are in-memory; a server restart drops history.
- The bunq SEPA leg targets a stand-in payee — production needs a real off-ramp IBAN (Bridge / BVNK).

## Future Considerations

- **Real off-ramp**: Bridge or BVNK for the EUR → USDC leg. The stub return shape already matches.
- **Live FX**: ECB or Wise; spread stays configurable.
- **Real AML**: Didit session API; the adapter is `aml_screen` in `stubs.py`.
- **Persistence**: SQLite for session history and audit-packet indexing; `.gitignore` already reserves `backend/data/diaspora.db*`.
- **Receipt distribution**: email or signed PDF endpoint; the JSON + hash are already produced.

## Tech Stack

| Layer | Choice |
|---|---|
| Agent | Claude Sonnet 4.5 (Anthropic SDK), tool-use loop |
| Backend | FastAPI, Server-Sent Events, httpx, cryptography (RSA), web3.py |
| Frontend | React 18, TypeScript, Vite |
| Banking | bunq sandbox API (RSA-2048 signed) |
| Chain | Base Sepolia (chain 84532), USDC |
| Audit | JSON + SHA-256 receipt hash |
