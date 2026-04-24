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
├── backend/      # FastAPI + agent
├── frontend/     # React + timeline UI
├── README.md
└── .gitignore
```

### `backend/`
FastAPI service hosting the payment agent. Handles intent parsing, contractor resolution, balance checks, FX quoting, compliance screening, on-chain execution, and receipt generation.

### `frontend/`
React app showing the payment timeline — each of the 15 legitimacy artifacts rendered as a step the user can inspect in real time, ending with the block explorer receipt.
