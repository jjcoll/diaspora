import asyncio
import hashlib
import json
import queue
import threading
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .agent import _agent_turn
from .aws import extract_invoice, transcribe_audio
from .tools import CONTACTS, resolve_contractor

app = FastAPI(title="diaspora")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS: dict[str, dict] = {}


def _contractor_id(slug: str) -> str:
    return f"c_{hashlib.sha1(slug.encode()).hexdigest()[:10]}"


def _fake_payments(slug: str) -> tuple[float, int]:
    h = int(hashlib.sha1(slug.encode()).hexdigest(), 16)
    count = (h % 9) + 1
    avg = 200 + (h % 600)
    return round(count * avg, 2), count


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/contractors")
def contractors():
    out = []
    for slug, v in CONTACTS.items():
        total, count = _fake_payments(slug)
        out.append({
            "id": _contractor_id(slug),
            "name": v["name"],
            "email": v.get("email", f"{slug}@example.com"),
            "country": v["country"],
            "wallet_address": v["wallet"],
            "status": "verified",
            "didit_session_id": "stub",
            "verified_at": "2026-04-01T00:00:00Z",
            "created_at": "2026-03-01T00:00:00Z",
            "paid_total_eur": total,
            "payments_count": count,
        })
    return out


class ChatBody(BaseModel):
    session_id: str
    message: str


@app.post("/api/chat")
def chat(body: ChatBody):
    session = SESSIONS.setdefault(body.session_id, {"messages": [], "state": {}})
    msg = body.message.strip()
    if msg.lower() in {"yes", "y"}:
        session["state"]["user_confirmed"] = True
    session["messages"].append({"role": "user", "content": msg})

    q: queue.Queue[Optional[dict]] = queue.Queue()

    def emit(ev: dict):
        q.put(ev)

    def run():
        try:
            messages, state = _agent_turn(session["messages"], session["state"], emit=emit)
            session["messages"] = messages
            session["state"] = state
        except Exception as exc:
            q.put({"type": "error", "message": str(exc)})
        finally:
            q.put(None)

    threading.Thread(target=run, daemon=True).start()

    async def stream():
        loop = asyncio.get_event_loop()
        while True:
            ev = await loop.run_in_executor(None, q.get)
            if ev is None:
                yield "event: done\ndata: {}\n\n"
                return
            yield f"data: {json.dumps(ev)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/api/transcribe")
async def transcribe_endpoint(audio: UploadFile = File(...)):
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty audio")
    mime = audio.content_type or "audio/webm"
    print(f"[transcribe] {len(data)} bytes, mime={mime}")
    try:
        text = await asyncio.to_thread(transcribe_audio, data, mime)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"transcribe failed: {exc}")
    return {"text": text.strip()}


@app.post("/api/extract-invoice")
async def extract_invoice_endpoint(file: UploadFile = File(...)):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    print(f"[extract-invoice] {len(data)} bytes, mime={file.content_type}")
    try:
        fields = await asyncio.to_thread(extract_invoice, data)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"textract failed: {exc}")
    display_name = fields["vendor"]
    if fields["vendor"]:
        match = resolve_contractor(fields["vendor"])
        if match.get("found"):
            display_name = match["name"]
            fields["matched_contact"] = match["name"]

    parts = ["Pay"]
    if display_name:
        parts.append(display_name)
    if fields["amount"] is not None:
        amount = fields["amount"]
        amount_str = f"{amount:.2f}".rstrip("0").rstrip(".") if isinstance(amount, float) else str(amount)
        parts.append(f"{amount_str} {fields['currency']}")
    if fields["invoice_ref"]:
        parts.append(f"for invoice {fields['invoice_ref']}")
    prefilled = " ".join(parts) if len(parts) > 1 else ""
    return {"fields": fields, "prefilled": prefilled}
