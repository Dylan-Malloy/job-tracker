import { describe, expect, it } from "vitest";
import { costUsd, priceFor } from "../ai/pricing";
import { computeAnalytics, sourceOf, weekStart } from "./analytics";
import { computeSpend, type UsageRow } from "./spend";

const NOW = new Date("2026-11-14T12:00:00Z");
const d = (s: string) => new Date(s).toISOString();

describe("pricing", () => {
  it("prices Sonnet 5.5 at $2 in / $10 out per million tokens", () => {
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBe(12);
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 3000, output_tokens: 1200 })).toBeCloseTo(0.018, 6);
  });
  it("prices cache reads and writes separately", () => {
    expect(costUsd("claude-sonnet-5-5", { cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000 })).toBeCloseTo(2.6, 6);
  });
  it("treats missing usage as zero and unknown models as Sonnet 5.5", () => {
    expect(costUsd("claude-sonnet-5-5", {})).toBe(0);
    expect(priceFor("some-future-model").known).toBe(false);
    expect(costUsd("some-future-model", { output_tokens: 1_000_000 })).toBe(10);
  });
});

describe("job analytics", () => {
  const jobs = [
    { id: "a", url: "https://www.linkedin.com/jobs/view/1", company: "Acme", status: "finished", outcome: "accepted", created_at: d("2026-11-03T10:00:00Z") },
    { id: "b", url: "https://indeed.com/viewjob?jk=2", company: "Acme", status: "finished", outcome: "denied", created_at: d("2026-11-04T10:00:00Z") },
    { id: "c", url: "https://boards.greenhouse.io/x/jobs/3", company: "Beta", status: "in_progress", outcome: null, created_at: d("2026-11-10T10:00:00Z") },
    { id: "d", url: "https://careers.northwind.example/4", company: "", status: "not_started", outcome: null, created_at: d("2026-08-01T10:00:00Z") },
  ];
  const events = [
    { job_id: "a", event: "moved", from_status: "not_started", to_status: "in_progress", outcome: null, created_at: d("2026-11-05T10:00:00Z") },
    { job_id: "a", event: "moved", from_status: "in_progress", to_status: "finished", outcome: "accepted", created_at: d("2026-11-09T10:00:00Z") },
    { job_id: "b", event: "moved", from_status: "not_started", to_status: "in_progress", outcome: null, created_at: d("2026-11-06T10:00:00Z") },
    { job_id: "b", event: "moved", from_status: "in_progress", to_status: "finished", outcome: "denied", created_at: d("2026-11-08T10:00:00Z") },
    { job_id: "c", event: "moved", from_status: "not_started", to_status: "in_progress", outcome: null, created_at: d("2026-11-11T10:00:00Z") },
  ];
  it("computes counts, hire rate and funnel", () => {
    const a = computeAnalytics(jobs, events, NOW, null);
    expect(a).toMatchObject({ total: 4, notStarted: 1, inProgress: 1, finished: 2, hired: 1, rejected: 1, applied: 3, hireRate: 0.5 });
    expect(a.funnel.map((f) => f.count)).toEqual([4, 3, 2, 1]);
  });
  it("computes average days to apply and to an outcome", () => {
    const a = computeAnalytics(jobs, events, NOW, null);
    expect(a.avgDaysToApply).toBeCloseTo((2 + 2 + 1) / 3, 5);
    expect(a.avgDaysToOutcome).toBeCloseTo((4 + 2) / 2, 5);
  });
  it("honours the range filter", () => {
    const a = computeAnalytics(jobs, events, NOW, 30);
    expect(a.total).toBe(3); // the August job is out of range
    expect(a.notStarted).toBe(0);
  });
  it("buckets weekly activity (weeks start Monday, UTC)", () => {
    const a = computeAnalytics(jobs, events, NOW, null);
    expect(a.weekly).toHaveLength(12);
    const w = a.weekly.find((x) => x.weekStart === "2026-11-02")!;
    expect(w).toMatchObject({ added: 2, applied: 2, hired: 0, rejected: 1 }); // B was rejected on Sunday Nov 8
    expect(a.weekly.find((x) => x.weekStart === "2026-11-09")).toMatchObject({ added: 1, applied: 1, hired: 1, rejected: 0 });
    expect(weekStart(new Date("2026-11-14T12:00:00Z")).toISOString().slice(0, 10)).toBe("2026-11-09");
  });
  it("groups sources and companies", () => {
    const a = computeAnalytics(jobs, events, NOW, null);
    expect(a.sources.map((s) => s.label)).toContain("linkedin.com");
    expect(a.companies[0]).toEqual({ label: "Acme", count: 2 });
    expect(sourceOf("not a url")).toBe("unknown");
  });
  it("handles an empty history", () => {
    const a = computeAnalytics([], [], NOW, null);
    expect(a.total).toBe(0);
    expect(a.hireRate).toBeNull();
    expect(a.avgDaysToApply).toBeNull();
  });
});

describe("ai spend", () => {
  const row = (iso: string, cost: number, over: Partial<UsageRow> = {}): UsageRow => ({
    created_at: iso, user_id: "u1", user_email: "a@x.com", feature: "resume_tailor", model: "claude-sonnet-5-5",
    input_tokens: 1000, output_tokens: 500, cache_write_tokens: 0, cache_read_tokens: 0, cost_usd: cost, ...over,
  });
  const rows = [
    row("2026-11-14T08:00:00Z", 0.02),
    row("2026-11-14T09:00:00Z", 0.03, { feature: "cover_letter", user_email: "b@x.com" }),
    row("2026-11-01T09:00:00Z", 0.5, { user_id: null, user_email: null }),
    row("2026-09-01T09:00:00Z", 1),
  ];
  it("totals, groups and sorts by cost", () => {
    const s = computeSpend(rows, NOW, 30);
    expect(s.totals.calls).toBe(3);
    expect(s.totals.cost).toBeCloseTo(0.55, 6);
    expect(s.byFeature[0].label).toBe("resume_tailor");
    expect(s.byUser.map((u) => u.label)).toContain("(deleted user)");
  });
  it("zero-fills a daily series and ends on today", () => {
    const s = computeSpend(rows, NOW, 30);
    expect(s.series).toHaveLength(30);
    expect(s.series[29]).toMatchObject({ date: "2026-11-14", calls: 2 });
    expect(s.series[0].calls).toBe(0);
  });
  it("projects month-end spend from month-to-date", () => {
    const s = computeSpend(rows, NOW, null);
    expect(s.monthToDate).toBeCloseTo(0.55, 6);
    expect(s.projectedMonth).toBeGreaterThan(s.monthToDate);
    expect(computeSpend([], NOW, 30).projectedMonth).toBe(0);
  });
});
