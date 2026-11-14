export type JobRow = { id: string; url: string; company: string; status: string; outcome: string | null; created_at: string };
export type EventRow = {
  job_id: string; event: string; from_status: string | null; to_status: string | null; outcome: string | null; created_at: string;
};

const DAY = 86_400_000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

export function sourceOf(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    for (const s of ["linkedin.com", "indeed.com", "glassdoor.com", "greenhouse.io", "lever.co", "workday.com", "ashbyhq.com"]) {
      if (h === s || h.endsWith("." + s)) return s;
    }
    return h;
  } catch {
    return "unknown";
  }
}

export function computeAnalytics(jobs: JobRow[], events: EventRow[], now: Date, rangeDays: number | null, weeks = 12) {
  const since = rangeDays ? now.getTime() - rangeDays * DAY : -Infinity;
  const inRange = jobs.filter((j) => new Date(j.created_at).getTime() >= since);
  const ids = new Set(inRange.map((j) => j.id));
  const ev = events.filter((e) => ids.has(e.job_id));

  const firstEvent = (jobId: string, to: string) =>
    ev.filter((e) => e.job_id === jobId && e.event === "moved" && e.to_status === to)
      .map((e) => new Date(e.created_at).getTime())
      .sort((a, b) => a - b)[0];

  const count = (f: (j: JobRow) => boolean) => inRange.filter(f).length;
  const hired = count((j) => j.status === "finished" && j.outcome === "accepted");
  const rejected = count((j) => j.status === "finished" && j.outcome === "denied");
  const finished = count((j) => j.status === "finished");
  const applied = inRange.filter((j) => j.status !== "not_started" || firstEvent(j.id, "in_progress") !== undefined).length;

  const toApply: number[] = [];
  const toOutcome: number[] = [];
  for (const j of inRange) {
    const created = new Date(j.created_at).getTime();
    const ap = firstEvent(j.id, "in_progress");
    const fin = firstEvent(j.id, "finished");
    if (ap !== undefined) toApply.push((ap - created) / DAY);
    if (fin !== undefined) toOutcome.push((fin - (ap ?? created)) / DAY);
  }

  // Weekly series for the last `weeks` weeks (UTC, weeks start Monday), independent of the range filter.
  const thisWeek = weekStart(now).getTime();
  const series = Array.from({ length: weeks }, (_, i) => {
    const start = thisWeek - (weeks - 1 - i) * 7 * DAY;
    return { weekStart: new Date(start).toISOString().slice(0, 10), start, added: 0, applied: 0, hired: 0, rejected: 0 };
  });
  const bucket = (iso: string) => series.find((w) => {
    const t = new Date(iso).getTime();
    return t >= w.start && t < w.start + 7 * DAY;
  });
  for (const j of jobs) { const b = bucket(j.created_at); if (b) b.added++; }
  for (const e of events) {
    if (e.event !== "moved") continue;
    const b = bucket(e.created_at);
    if (!b) continue;
    if (e.to_status === "in_progress") b.applied++;
    if (e.to_status === "finished") { if (e.outcome === "accepted") b.hired++; else if (e.outcome === "denied") b.rejected++; }
  }

  const tally = (keys: string[]) => {
    const m = new Map<string, number>();
    keys.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, n]) => ({ label, count: n }));
  };

  return {
    total: inRange.length,
    notStarted: count((j) => j.status === "not_started"),
    inProgress: count((j) => j.status === "in_progress"),
    finished, hired, rejected, applied,
    hireRate: finished ? hired / finished : null,
    avgDaysToApply: mean(toApply),
    avgDaysToOutcome: mean(toOutcome),
    funnel: [
      { label: "Added", count: inRange.length },
      { label: "Applied", count: applied },
      { label: "Finished", count: finished },
      { label: "Hired", count: hired },
    ],
    weekly: series.map((w) => ({ weekStart: w.weekStart, added: w.added, applied: w.applied, hired: w.hired, rejected: w.rejected })),
    sources: tally(inRange.map((j) => sourceOf(j.url))).slice(0, 6),
    companies: tally(inRange.map((j) => j.company.trim() || "Unknown")).slice(0, 6),
  };
}
