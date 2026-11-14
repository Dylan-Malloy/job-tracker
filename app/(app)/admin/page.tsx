import { BarList, ColumnChart } from "@/components/admin/charts";
import { RangeTabs } from "@/components/admin/admin-tabs";
import { StatCard } from "@/components/admin/stat-card";
import { computeAnalytics } from "@/lib/admin/analytics";
import { parseRange, RANGES } from "@/lib/admin/data";
import { getHubContext } from "@/lib/hub";
import { fmtDateTime, getTimeZone } from "@/lib/tz";

const days = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)} days`);
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const STATUS: Record<string, string> = { not_started: "Not started", in_progress: "In-progress", finished: "Finished" };

export default async function AdminAnalytics({ searchParams }: PageProps<"/admin">) {
  const range = parseRange((await searchParams).range);
  const { supabase, hubs } = await getHubContext();
  const tz = await getTimeZone();
  const own = hubs.find((h) => h.role === "owner");
  if (!own) return <p className="card text-sm text-muted">You don&apos;t own a hub yet.</p>;

  const [{ data: jobs }, { data: events }, { data: recent }] = await Promise.all([
    supabase.from("jobs").select("id, url, company, status, outcome, created_at").eq("hub_id", own.id),
    supabase.from("job_events").select("job_id, event, from_status, to_status, outcome, created_at").eq("hub_id", own.id).limit(5000),
    supabase.from("job_events").select("id, job_id, event, to_status, outcome, created_at, jobs(company, position)").eq("hub_id", own.id).order("created_at", { ascending: false }).limit(12),
  ]);
  const a = computeAnalytics(jobs ?? [], events ?? [], new Date(), range.days);
  const fmtWeek = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Your hub&apos;s application history · {own.name}</p>
        <RangeTabs base="/admin" current={range.key} options={RANGES.map((r) => ({ key: r.key, label: r.label }))} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Applications added" value={String(a.total)} hint={`${a.notStarted} not started`} />
        <StatCard label="In-progress" value={String(a.inProgress)} tone="warn" />
        <StatCard label="Hired" value={String(a.hired)} tone="good" hint={`${a.rejected} rejected`} />
        <StatCard label="Hire rate" value={pct(a.hireRate)} hint={a.finished ? `of ${a.finished} finished` : "no finished yet"} />
        <StatCard label="Applied" value={String(a.applied)} hint={a.total ? `${Math.round((a.applied / a.total) * 100)}% of added` : undefined} />
        <StatCard label="Avg. time to apply" value={days(a.avgDaysToApply)} hint="added → applied" />
        <StatCard label="Avg. time to outcome" value={days(a.avgDaysToOutcome)} hint="applied → hired/rejected" />
        <StatCard label="Rejected" value={String(a.rejected)} tone="bad" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">Added vs. applied, per week</h2>
          <ColumnChart
            points={a.weekly.map((w) => ({ label: fmtWeek(w.weekStart), values: [w.added, w.applied] }))}
            series={[{ name: "Added", color: "#fb923c" }, { name: "Applied", color: "#facc15" }]} labelEvery={2} />
        </section>
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">Outcomes, per week</h2>
          <ColumnChart
            points={a.weekly.map((w) => ({ label: fmtWeek(w.weekStart), values: [w.hired, w.rejected] }))}
            series={[{ name: "Hired", color: "#4ade80" }, { name: "Rejected", color: "#f87171" }]} labelEvery={2} />
        </section>
      </div>
      <p className="-mt-3 text-xs text-muted">Weeks start Monday (UTC). Status history is recorded from the day the admin panel launched; earlier moves aren&apos;t in the timing figures.</p>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">Funnel</h2>
          <BarList items={a.funnel.map((f) => ({ label: f.label, value: f.count, sub: a.total ? `${Math.round((f.count / a.total) * 100)}%` : "" }))} color="var(--primary)" />
        </section>
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">Where jobs come from</h2>
          <BarList items={a.sources.map((s) => ({ label: s.label, value: s.count }))} color="#fb923c" empty="No jobs in this range." />
        </section>
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">Top companies</h2>
          <BarList items={a.companies.map((s) => ({ label: s.label, value: s.count }))} color="#4ade80" empty="No jobs in this range." />
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
        {(recent ?? []).length === 0 ? <p className="text-sm text-muted">No activity yet.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="pb-2 font-medium">When</th><th className="pb-2 font-medium">Job</th><th className="pb-2 font-medium">What happened</th></tr></thead>
            <tbody>
              {(recent ?? []).map((e) => {
                const job = e.jobs as unknown as { company: string; position: string } | null;
                const what = e.event === "created" ? "Added to Not started"
                  : e.to_status === "finished" ? `Finished — ${e.outcome === "accepted" ? "hired" : "rejected"}` : `Moved to ${STATUS[e.to_status ?? ""] ?? e.to_status}`;
                return (
                  <tr key={e.id} className="border-t border-border/60">
                    <td className="whitespace-nowrap py-2 pr-4 text-muted">{fmtDateTime(e.created_at, tz)}</td>
                    <td className="py-2 pr-4">{job ? `${job.position} · ${job.company}` : "(deleted job)"}</td>
                    <td className="py-2">{what}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
