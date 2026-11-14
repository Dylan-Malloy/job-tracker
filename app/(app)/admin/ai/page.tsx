import { BarList, ColumnChart } from "@/components/admin/charts";
import { RangeTabs } from "@/components/admin/admin-tabs";
import { StatCard } from "@/components/admin/stat-card";
import { PRICES, PRICING_AS_OF } from "@/lib/ai/pricing";
import { MODEL } from "@/lib/ai/client";
import { fetchUsage, parseRange, RANGES } from "@/lib/admin/data";
import { compact, computeSpend, FEATURE_LABEL, usd } from "@/lib/admin/spend";
import { fmtDateTime, getTimeZone } from "@/lib/tz";

export default async function AiSpend({ searchParams }: PageProps<"/admin/ai">) {
  const range = parseRange((await searchParams).range);
  const tz = await getTimeZone();
  const rows = await fetchUsage();
  const s = computeSpend(rows, new Date(), range.days);
  const price = PRICES[MODEL];
  const inRange = s.inRange;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Claude token usage and estimated cost, recorded on every call</p>
        <RangeTabs base="/admin/ai" current={range.key} options={RANGES.map((r) => ({ key: r.key, label: r.label }))} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Spend in range" value={usd(s.totals.cost)} hint={`${s.totals.calls} calls`} />
        <StatCard label="Month to date" value={usd(s.monthToDate)} hint={`≈ ${usd(s.projectedMonth)} by month end`} tone="warn" />
        <StatCard label="Input tokens" value={compact(s.totals.input)} />
        <StatCard label="Output tokens" value={compact(s.totals.output)} hint={`${usd(s.avgCostPerCall)} avg per call`} />
      </div>

      <section className="card">
        <h2 className="mb-4 text-sm font-semibold">Spend per day</h2>
        <ColumnChart points={s.series.map((d) => ({ label: d.date.slice(5), values: [d.cost] }))} series={[{ name: "Estimated cost (USD)", color: "#a177ff" }]}
          format={(n) => usd(n, n < 0.1 ? 3 : n < 1 ? 2 : 0)} labelEvery={Math.ceil(s.series.length / 8)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">By feature</h2>
          <BarList items={s.byFeature.map((f) => ({ label: FEATURE_LABEL[f.label] ?? f.label, value: f.cost, sub: `${f.calls} calls` }))} format={(n) => usd(n)} color="#fb923c" empty="No AI calls in this range." />
        </section>
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">By user</h2>
          <BarList items={s.byUser.map((u) => ({ label: u.label, value: u.cost, sub: `${u.calls} calls` }))} format={(n) => usd(n)} color="#4ade80" empty="No AI calls in this range." />
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Recent calls</h2>
        {inRange.length === 0 ? <p className="text-sm text-muted">No calls recorded yet. They appear here as people use the AI features.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted"><tr>{["When", "User", "Feature", "In", "Out", "Cost"].map((h) => <th key={h} className="pb-2 pr-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {inRange.slice(0, 25).map((r, i) => (
                <tr key={i} className="border-t border-border/60">
                  <td className="whitespace-nowrap py-2 pr-3 text-muted">{fmtDateTime(r.created_at, tz)}</td>
                  <td className="py-2 pr-3">{r.user_email ?? "(deleted user)"}</td>
                  <td className="py-2 pr-3">{FEATURE_LABEL[r.feature] ?? r.feature}</td>
                  <td className="py-2 pr-3 tabular-nums">{compact(r.input_tokens + r.cache_write_tokens + r.cache_read_tokens)}</td>
                  <td className="py-2 pr-3 tabular-nums">{compact(r.output_tokens)}</td>
                  <td className="py-2 tabular-nums">{usd(Number(r.cost_usd))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-muted">
        Costs are estimates from token counts × published prices as of {PRICING_AS_OF}
        {price ? ` (${MODEL}: $${price.input}/M input, $${price.output}/M output, $${price.cacheRead}/M cache reads)` : ""}. Your Anthropic invoice is the source of truth. Tracking began when this panel launched, so earlier usage isn&apos;t included.
      </p>
    </div>
  );
}
