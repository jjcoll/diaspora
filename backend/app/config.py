import os
import sys
from dotenv import load_dotenv, dotenv_values

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BACKEND_DIR, ".env")
CONTACTS_PATH = os.path.join(BACKEND_DIR, "data", "contacts.json")
CTX_PATH = os.path.join(BACKEND_DIR, "bunq_context.json")
AUDIT_DIR = os.path.join(BACKEND_DIR, "audit_packets")

load_dotenv(dotenv_path=ENV_PATH, override=True)
ENV = dotenv_values(ENV_PATH)

DEBUG = os.getenv("DIASPORA_DEBUG", "").lower() in ("1", "true", "yes")


def run_preflight() -> None:
    problems = []
    if not (ENV.get("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY")):
        problems.append((
            "ANTHROPIC_API_KEY missing",
            "set it in backend/.env (cp .env.example .env)",
        ))
    if not os.path.exists(CONTACTS_PATH):
        problems.append((
            f"contacts.json missing at {CONTACTS_PATH}",
            "create it (see README) or restore from git",
        ))
    if not os.path.exists(CTX_PATH):
        problems.append((
            f"bunq_context.json missing at {CTX_PATH}",
            "run: .venv/bin/python scripts/bunq_setup.py",
        ))
    if problems:
        print("Preflight failed:")
        for problem, fix in problems:
            print(f"  - {problem}")
            print(f"    fix: {fix}")
        sys.exit(1)
    os.makedirs(AUDIT_DIR, exist_ok=True)
