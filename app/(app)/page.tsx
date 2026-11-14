import Link from "next/link";
import { AddJob } from "@/components/add-job";
import { JobCard } from "@/components/job-card";
import { getHubContext } from "@/lib/hub";

// Orange → yellow → green mirrors the workflow. Full class names so Tailwind can see them.
const TABS = [
  {
    key: "not_started", label: "NOT STARTED", tip: "Jobs waiting for you to apply",
    idle: "border-orange-400/40 text-orange-300 hover:bg-orange-400/10",
    active: "border-orange-400 bg-orange-400/20 text-orange-100 shadow-[0_0_0_3px_rgba(251,146,60,0.15)]",
  },
  {
    key: "in_progress", label: "IN-PROGRESS", tip: "Jobs you've applied to and are waiting on",
    idle: "border-yellow-400/40 text-yellow-300 hover:bg-yellow-400/10",
    active: "border-yellow-400 bg-yellow-400/20 text-yellow-100 shadow-[0_0_0_3px_rgba(250,204,21,0.15)]",
  },
  {
    key: "finished", label: "FINISHED", tip: "Applications that ended in a hiring or a rejection",
    idle: "border-green-400/40 text-green-300 hover:bg-green-400/10",
    active: "border-green-400 bg-green-400/20 text-green-100 shadow-[0_0_0_3px_rgba(74,222,128,0.15)]",
  },
] as const;

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "not_started";
  const sort = sp.sort === "accepted" || sp.sort === "denied" ? sp.sort : "all";
  const { supabase, current } = await getHubContext();
  const hub = current!;

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, url, company, position, status, outcome, requirements, created_at")
    .eq("hub_id", hub.id)
    .order("created_at", { ascending: false });

  const all = jobs ?? [];
  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter((j) => j.status === t.key).length]));
  let list = all.filter((j) => j.status === tab);
  if (tab === "finished" && sort !== "all") list = list.filter((j) => j.outcome === sort);
  if (tab === "finished") list = [...list].sort((a, b) => (a.outcome === b.outcome ? 0 : a.outcome === "accepted" ? -1 : 1));

  const canAdd = hub.role === "owner" || hub.role === "helper";
  const empty: Record<string, string> = {
    not_started: "No job offers waiting. Paste a link above to add one.",
    in_progress: "Nothing in progress yet. Move a job here after you apply.",
    finished: "No finished applications yet.",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{hub.name}</h1>
        <p className="text-sm text-muted">
          {hub.role === "viewer" && "View-only access. "}
          {hub.role === "helper" && "You can add job offers and upload resumes. "}
          Track every application from NOT STARTED to FINISHED.
        </p>
      </div>

      {canAdd && <AddJob hubId={hub.id} />}

      <nav className="flex flex-wrap gap-2" aria-label="Application lists">
        {TABS.map((t) => (
          <Link key={t.key} href={`/?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined} data-tip={t.tip}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${tab === t.key ? t.active : t.idle}`}>
            {t.label} <span className="ml-1 text-xs opacity-70">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      {tab === "finished" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Show:</span>
          {[["all", "All"], ["accepted", "Hirings"], ["denied", "Rejections"]].map(([k, l]) => (
            <Link key={k} href={`/?tab=finished&sort=${k}`}
              data-tip={k === "all" ? "Show every finished application" : k === "accepted" ? "Show only jobs where you were hired" : "Show only jobs where you were rejected"}
              className={`rounded-md px-2 py-1 ${sort === k ? "bg-surface-2 text-accent" : "text-muted hover:text-text"}`}>{l}</Link>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {list.length === 0 && <p className="card text-center text-sm text-muted">{empty[tab]}</p>}
        {list.map((j) => <JobCard key={j.id} job={j} isOwner={hub.role === "owner"} />)}
      </div>
    </div>
  );
}
