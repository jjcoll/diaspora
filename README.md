# Diaspora

A multimodal AI payment agent that turns plain language, voice notes, and invoice documents into compliant cross-border transfers — using stablecoins as invisible rails to collapse 5-day, ~7%-fee SEPA payments into 20-second, fully auditable transactions on top of bunq.

> **Built for [bunq Hackathon 7.0](https://bunq.com)** — Multimodal AI in banking.

## Live Demo

- **Frontend:** https://diaspora-dusky.vercel.app
- **Backend API:** https://backend-red-sky-7100.fly.dev
- **Source:** https://github.com/jjcoll/diaspora

Try it from the live URL: tap the mic and speak ("pay José 480 euros for the weaving workshop"), or click the paperclip and upload `Invoice for Jose Nov 2024.pdf` from this repo. The agent runs the full flow — resolve, balance check, AML, FX quote, consent, execute, audit packet — in front of your eyes via Server-Sent Events.

## The Problem

Paying a freelancer in Venezuela or Nigeria from a European bank account today means a 5-day wait, ~7% in fees, and zero visibility into where the money is. SEPA doesn't reach them. SWIFT does, badly. Stablecoins reach them in seconds — but no bank operator wants to touch the compliance, FX, and audit story themselves.

## The Solution

A multimodal AI agent that takes a plain-language instruction (*"pay José €500"*), a voice note, or an uploaded invoice, routes the payment through stablecoin rails, and hands back a receipt that an auditor would sign off on — all in under 20 seconds.

The user sees a single conversational surface: text, voice, or document in, a transparent quote card to approve, then a receipt with an on-chain transaction hash. The compliance, FX, settlement, and audit-packet generation happen invisibly in between.

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
   ├──► Amazon Transcribe     (voice → text, batch via S3)
   ├──► Amazon Textract       (invoice → structured fields, AnalyzeExpense)
   └──► Base Sepolia RPC      (wallet/setup only; settlement uses pre-baked tx)
```

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/contractors` | Contact book + (synthetic) payment history |
| `POST` | `/api/chat` | SSE-streamed agent turn |
| `POST` | `/api/transcribe` | Voice note (multipart audio) → text via Amazon Transcribe |
| `POST` | `/api/extract-invoice` | Invoice (PDF / image) → `{vendor, amount, currency, invoice_ref}` via Amazon Textract |

### Frontend flow

`PaymentsTab` → `Composer` (text, voice, or invoice attachment) → SSE-driven timeline that renders each step the agent runs → `QuoteCard` (suppresses the composer until the user clicks **Confirm**) → `ReceiptSummary` → `ReceiptModal` with a downloadable PDF receipt and a block-explorer link.

The `Composer` records voice with the browser `MediaRecorder` API and POSTs the blob to `/api/transcribe` (Amazon Transcribe). For documents, the paperclip button opens a file picker, POSTs the file to `/api/extract-invoice` (Amazon Textract `AnalyzeExpense`), and prefills the input with `Pay {vendor} {amount} {currency} for invoice {invoice_ref}` so the user can review and send.

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

We were honest about the line. Real integrations are real; the things we couldn't wire to a live API in the hackathon window are stubbed in `app/stubs.py`, and **every stub returns the exact shape the real API would**, so swapping in is a single-file change.

| Component | Status | Notes |
|---|---|---|
| bunq sandbox auth (RSA-2048 install/device/session handshake) | real | `scripts/bunq_setup.py` |
| bunq balance check (RSA-signed GET) | real | `app/bunq.py` |
| Anthropic tool-use loop | real | `app/agent.py` |
| Audit packet (JSON + SHA-256) | real | `app/audit.py` |
| Voice → text (Amazon Transcribe, batch via S3) | real | `app/aws.py`, `POST /api/transcribe` |
| Invoice → structured fields (Amazon Textract `AnalyzeExpense`) | real | `app/aws.py`, `POST /api/extract-invoice` |
| AML screening | stub → **Didit** | shape matches Didit session API |
| FX quote | stub → **ECB / Wise** | hardcoded 1.08 with configurable spread |
| SEPA payment execution | stub → **Bridge / BVNK** | shape matches an off-ramp IBAN call |
| USDC settlement | stub → **Bridge / BVNK** | returns a pre-baked Base Sepolia tx hash |

## Run It

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                              # BUNQ_API_KEY, ANTHROPIC_API_KEY, AWS_*
.venv/bin/python scripts/bunq_setup.py            # RSA handshake → bunq_context.json
.venv/bin/python scripts/sepolia_setup.py         # wallet + FAKE_TX_HASH for settlement
.venv/bin/uvicorn app.server:app --reload         # API on :8000
```

```bash
cd frontend
npm install
npm run dev                                       # UI on :5173
```

## Deploy

Backend → **Fly.io** (Docker, `ams` region). Frontend → **Vercel** (Vite, `frontend/` as Root Directory). The repo ships `backend/Dockerfile`, `backend/fly.toml`, and `frontend/vercel.json`. `bunq_context.json` is read from the `BUNQ_CONTEXT_JSON` env var when set, so Fly secrets work without volume mounts. CORS is env-driven (`CORS_ORIGINS`).

Live: `https://diaspora-dusky.vercel.app` → `https://backend-red-sky-7100.fly.dev`

## Known Limitations

- AML, FX, SEPA execution, and USDC settlement are stubs with the right shape but no upstream calls.
- Sessions are in-memory; a server restart drops history.
- The bunq SEPA leg targets a stand-in payee — production needs a real off-ramp IBAN (Bridge / BVNK).
- AWS workshop credentials are short-lived (a few hours). Refresh via CloudShell `aws configure export-credentials --format env` before each demo.
- Textract `AnalyzeExpense` synchronous path supports single-page PDFs and images. Multi-page invoices need the async API.

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
| Backend | FastAPI, Server-Sent Events, httpx, cryptography (RSA), web3.py, boto3 |
| Frontend | React 18, TypeScript, Vite, MediaRecorder API |
| Banking | bunq sandbox API (RSA-2048 signed) |
| Multimodal | Amazon Transcribe (voice), Amazon Textract `AnalyzeExpense` (documents) |
| Chain | Base Sepolia (chain 84532), USDC |
| Audit | JSON + SHA-256 receipt hash |
