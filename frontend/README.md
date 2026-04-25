# diaspora frontend

Vite + React + TypeScript. Two tabs: **Contractors** (compliance/KYC list, invite flow) and **Payments** (chat input + streaming timeline + receipt).

## Setup

```bash
cd frontend
npm install
npm run dev
```

Vite serves on `http://localhost:5173` and proxies `/api/*` to `http://localhost:8000` (see `vite.config.ts`).

## Demo flow

1. Start backend (`cd ../backend && uvicorn app.main:app --reload`) on :8000.
2. Start this dev server on :5173.
3. Contractors tab — José (🇻🇪, verified) loads from seed.
4. Click "Invite contractor" → fill form → submit → new pending row + copyable verification URL banner.
5. Switch to Payments tab → type `pay José 500 EUR for October invoice` → send → watch 8 timeline events stream in, receipt panel appears with block explorer link.
