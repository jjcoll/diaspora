import json
import os
import time
import uuid

import boto3
from botocore.exceptions import ClientError

REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
BUCKET = os.getenv("AWS_S3_BUCKET")

_session = boto3.session.Session(region_name=REGION)
s3 = _session.client("s3")
transcribe = _session.client("transcribe")
textract = _session.client("textract")


def ensure_bucket() -> str:
    if not BUCKET:
        raise RuntimeError("AWS_S3_BUCKET not set")
    try:
        s3.head_bucket(Bucket=BUCKET)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("404", "NoSuchBucket", "NotFound"):
            kw: dict = {"Bucket": BUCKET}
            if REGION != "us-east-1":
                kw["CreateBucketConfiguration"] = {"LocationConstraint": REGION}
            s3.create_bucket(**kw)
        else:
            raise
    return BUCKET


def _ext_from_mime(mime: str) -> str:
    m = (mime or "").lower()
    if "webm" in m:
        return "webm"
    if "ogg" in m:
        return "ogg"
    if "mpeg" in m or "mp3" in m:
        return "mp3"
    if "wav" in m:
        return "wav"
    if "mp4" in m or "m4a" in m:
        return "mp4"
    if "flac" in m:
        return "flac"
    return "webm"


def transcribe_audio(audio_bytes: bytes, mime: str = "audio/webm", language: str = "en-US") -> str:
    ensure_bucket()
    ext = _ext_from_mime(mime)
    job_name = f"diaspora-{uuid.uuid4().hex[:12]}"
    audio_key = f"audio/{job_name}.{ext}"
    transcript_key = f"transcripts/{job_name}.json"

    s3.put_object(Bucket=BUCKET, Key=audio_key, Body=audio_bytes, ContentType=mime)

    transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        Media={"MediaFileUri": f"s3://{BUCKET}/{audio_key}"},
        MediaFormat=ext,
        LanguageCode=language,
        OutputBucketName=BUCKET,
        OutputKey=transcript_key,
    )

    deadline = time.time() + 90
    while time.time() < deadline:
        resp = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        status = resp["TranscriptionJob"]["TranscriptionJobStatus"]
        if status == "COMPLETED":
            obj = s3.get_object(Bucket=BUCKET, Key=transcript_key)
            payload = json.loads(obj["Body"].read())
            return payload["results"]["transcripts"][0]["transcript"]
        if status == "FAILED":
            reason = resp["TranscriptionJob"].get("FailureReason", "unknown")
            raise RuntimeError(f"Transcribe failed: {reason}")
        time.sleep(0.6)
    raise TimeoutError("Transcribe job timed out")


def _parse_amount(value: str) -> tuple[float | None, str | None]:
    if not value:
        return None, None
    currency = None
    if "€" in value or "EUR" in value.upper():
        currency = "EUR"
    elif "$" in value or "USD" in value.upper():
        currency = "USD"
    elif "£" in value or "GBP" in value.upper():
        currency = "GBP"
    cleaned = "".join(c for c in value if c.isdigit() or c in ".,")
    if not cleaned:
        return None, currency
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(",", "")
    elif "," in cleaned and "." not in cleaned:
        cleaned = cleaned.replace(",", ".")
    try:
        return float(cleaned), currency
    except ValueError:
        return None, currency


def extract_invoice(file_bytes: bytes) -> dict:
    resp = textract.analyze_expense(Document={"Bytes": file_bytes})
    out = {"vendor": None, "amount": None, "currency": None, "invoice_ref": None}
    for doc in resp.get("ExpenseDocuments", []):
        for field in doc.get("SummaryFields", []):
            ftype = field.get("Type", {}).get("Text", "")
            value = (field.get("ValueDetection") or {}).get("Text", "").strip()
            if not value:
                continue
            if ftype == "VENDOR_NAME" and not out["vendor"]:
                out["vendor"] = value
            elif ftype == "TOTAL" and out["amount"] is None:
                amount, currency = _parse_amount(value)
                out["amount"] = amount
                if currency:
                    out["currency"] = currency
            elif ftype == "INVOICE_RECEIPT_ID" and not out["invoice_ref"]:
                out["invoice_ref"] = value
    out["currency"] = out["currency"] or "EUR"
    return out
