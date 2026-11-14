export type UsageRow = {
  created_at: string; user_id: string | null; user_email: string | null; feature: string; model: string;
  input_tokens: number; output_tokens: number; cache_write_tokens: number; cache_read_tokens: number; cost_usd: number | string;
};

const DAY = 86_400_000;
const num = (v: number | string) => Number(v) || 0;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export const FEATURE_LABEL: Record<string, string> = {
  job_extract: "Reading job links",
  resume_tailor: "Resume tailoring",
  resume_factcheck: "Resume fact-check",
  cover_letter: "Cover letters",
  cover_letter_factcheck: "Cover letter fact-check",
};

export function computeSpend(rows: UsageRow[], now: Date, rangeDays: number | null) {
  const since = rangeDays ? now.getTime() - rangeDays * DAY : -Infinity;
  const inRange = rows.filter((r) => new Date(r.created_at).getTime() >= since);

  const sum = (rs: UsageRow[]) => ({
    calls: rs.length,
    cost: rs.reduce((a, r) => a + num(r.cost_usd), 0),
    input: rs.reduce((a, r) => a + r.input_tokens + r.cache_write_tokens + r.cache_read_tokens, 0),
    output: rs.reduce((a, r) => a + r.output_tokens, 0),
  });
  const group = (key: (r: UsageRow) => string) => {
    const m = new Map<string, UsageRow[]>();
    inRange.forEach((r) => m.set(key(r), [...(m.get(key(r)) ?? []), r]));
    return [...m.entries()].map(([label, rs]) => ({ label, ...sum(rs) })).sort((a, b) => b.cost - a.cost);
  };

  // Daily series over the range (default 30 days when "all"), zero-filled.
  const days = rangeDays ?? 30;
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getTime() - (days - 1 - i) * DAY);
    return { date: dayKey(d), cost: 0, calls: 0 };
  });
  const idx = new Map(series.map((s, i) => [s.date, i]));
  for (const r of inRange) {
    const i = idx.get(dayKey(new Date(r.created_at)));
    if (i !== undefined) { series[i].cost += num(r.cost_usd); series[i].calls++; }
  }

  // Month-to-date and a straight-line projection to month end (UTC).
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const mtd = rows.filter((r) => new Date(r.created_at).getTime() >= monthStart).reduce((a, r) => a + num(r.cost_usd), 0);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const elapsed = Math.max(1, (now.getTime() - monthStart) / DAY);
  const projected = (mtd / elapsed) * daysInMonth;

  return {
    inRange,
    totals: sum(inRange),
    series,
    byFeature: group((r) => r.feature),
    byUser: group((r) => r.user_email ?? "(deleted user)"),
    byModel: group((r) => r.model),
    monthToDate: mtd,
    projectedMonth: projected,
    avgCostPerCall: inRange.length ? sum(inRange).cost / inRange.length : 0,
  };
}

export const usd = (n: number, digits = n < 1 ? 4 : 2) => `$${n.toFixed(digits)}`;
export const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
