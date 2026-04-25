# diaspora backend

FastAPI service hosting the payment agent and contractor management endpoints.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DIDIT_API_KEY if enabling real Didit
uvicorn app.main:app --reload
```

Server runs on `http://localhost:8000`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/health` | Health check |
| GET  | `/api/contractors` | List contractors |
| POST | `/api/contractors/invite` | Invite a new contractor, returns verification URL |
| POST | `/api/didit/webhook` | Didit webhook (manually callable in dev to flip pending → verified) |
| POST | `/api/chat` | SSE stream of payment timeline events |

## Didit integration

By default `DIDIT_ENABLED=false` — the invite endpoint returns a stub `verification_url` so the UI works without real credentials.

To enable real Didit session creation:

1. Set `DIDIT_ENABLED=true` in `.env`
2. Supply `DIDIT_API_KEY` and `DIDIT_WORKFLOW_ID`
3. Restart the server

## Dev: manually verify a pending contractor

```bash
curl -XPOST http://localhost:8000/api/didit/webhook \
  -H 'content-type: application/json' \
  -d '{"session_id":"<uuid-from-invite-response>","status":"Approved"}'
```

Refresh the frontend — the contractor's pill flips from amber to green.
