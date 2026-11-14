import Link from "next/link";
import { AddJob } from "@/components/add-job";
import { JobCard } from "@/components/job-card";
import { getHubContext } from "@/lib/hub";

const TABS = [
  { key: "not_started", label: "NOT STARTED" },
  { key: "in_progress", label: "IN-PROGRESS" },
  { key: "finished", label: "FINISHED" },
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
            className={`rounded-full border px-4 py-1.5 text-sm transition ${tab === t.key ? "border-primary bg-primary/20 text-text" : "border-border text-muted hover:text-text"}`}>
            {t.label} <span className="ml-1 text-xs opacity-70">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      {tab === "finished" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Show:</span>
          {[["all", "All"], ["accepted", "Hirings"], ["denied", "Rejections"]].map(([k, l]) => (
            <Link key={k} href={`/?tab=finished&sort=${k}`}
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
