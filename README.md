# Diaspora

A multimodal AI payment agent that turns plain language, voice notes, and invoice documents into compliant cross-border transfers — using stablecoins as invisible rails to collapse 5-day, ~7%-fee SEPA payments into 20-second, fully auditable transactions on top of bunq.

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

| Component | Status | Notes |
|---|---|---|
| bunq sandbox auth (RSA-2048 install/device/session handshake) | real | `scripts/bunq_setup.py` |
| bunq balance check (RSA-signed GET) | real | `app/bunq.py` |
| Anthropic tool-use loop | real | `app/agent.py` |
| Audit packet (JSON + SHA-256) | real | `app/audit.py` |
| Voice input → text (Amazon Transcribe, batch via S3) | real | `app/aws.py`, `POST /api/transcribe` |
| Invoice scan → structured fields (Amazon Textract `AnalyzeExpense`) | real | `app/aws.py`, `POST /api/extract-invoice` |
| AML screening | stub | drop-in shape for Didit |
| FX quote | stub | hardcoded 1.08, ECB/Wise drop-in |
| SEPA payment execution | stub | shape matches a bridge.xyz off-ramp IBAN call |
| USDC settlement | stub | returns a pre-baked Base Sepolia tx hash from setup |

Every stub lives in `app/stubs.py` and returns the exact shape the real API would. Swapping in a live integration is a single-file change.

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

Backend → **Fly.io**, frontend → **Vercel**. Both have free tiers and the round-trip from `git push` to live URL is ~5 minutes.

### Backend (Fly.io)

The repo ships `backend/Dockerfile` and `backend/fly.toml`. The app reads its bunq context from `BUNQ_CONTEXT_JSON` (env var, JSON-encoded) instead of a file when set, so no volume mounts are needed.

```bash
cd backend
flyctl launch --no-deploy --copy-config            # creates app, accepts existing fly.toml
flyctl secrets set \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  BUNQ_API_KEY="$BUNQ_API_KEY" \
  BUNQ_USER_ID="$BUNQ_USER_ID" \
  BUNQ_ACCOUNT_ID="$BUNQ_ACCOUNT_ID" \
  BUNQ_CONTEXT_JSON="$(cat bunq_context.json)" \
  AWS_ACCESS_KEY_ID="..." \
  AWS_SECRET_ACCESS_KEY="..." \
  AWS_SESSION_TOKEN="..." \
  AWS_REGION=us-east-1 \
  AWS_S3_BUCKET=diaspora-uploads-<account-id> \
  CORS_ORIGINS="https://diaspora.vercel.app,https://<your-vercel-preview>.vercel.app"
flyctl deploy --remote-only
```

> **Use a real IAM user for the deployed env**, not the workshop STS creds — those expire in hours. Create one in your AWS account with `AmazonTextractFullAccess`, `AmazonTranscribeFullAccess`, and S3 access scoped to the upload bucket. Drop `AWS_SESSION_TOKEN` from the secrets above when you switch.

### Frontend (Vercel)

The repo ships `frontend/vercel.json` (SPA rewrites). Connect the GitHub repo in Vercel, set:
- **Root Directory:** `frontend`
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variable:** `VITE_API_BASE=https://diaspora-backend.fly.dev` (or whatever your Fly URL is)

Then deploy. The frontend talks to the Fly backend directly (no Vite proxy in prod).

### Demo URL

After both are deployed: `https://diaspora.vercel.app` (or your custom Vercel domain).

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
