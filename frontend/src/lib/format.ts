export const COUNTRY_FLAGS: Record<string, string> = {
  VE: "🇻🇪", NG: "🇳🇬", AR: "🇦🇷", CO: "🇨🇴", PH: "🇵🇭",
  IN: "🇮🇳", BR: "🇧🇷", MX: "🇲🇽", KE: "🇰🇪", PK: "🇵🇰",
  ID: "🇮🇩", VN: "🇻🇳", EG: "🇪🇬", TR: "🇹🇷", ZA: "🇿🇦",
};

export const COUNTRY_NAMES: Record<string, string> = {
  VE: "Venezuela", NG: "Nigeria", AR: "Argentina", CO: "Colombia",
  PH: "Philippines", IN: "India", BR: "Brazil", MX: "Mexico",
  KE: "Kenya", PK: "Pakistan", ID: "Indonesia", VN: "Vietnam",
  EG: "Egypt", TR: "Turkey", ZA: "South Africa",
};

export function flagFor(code: string | null | undefined): string {
  if (!code) return "🏳️";
  return COUNTRY_FLAGS[code.toUpperCase()] ?? "🏳️";
}

export function countryName(code: string | null | undefined): string {
  if (!code) return "—";
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}

export function truncateMid(s: string | null | undefined, start = 6, end = 4): string {
  if (!s) return "—";
  return s.length > start + end + 1 ? `${s.slice(0, start)}…${s.slice(-end)}` : s;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function formatEUR(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
