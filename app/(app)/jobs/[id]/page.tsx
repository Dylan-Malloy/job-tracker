import Link from "next/link";
import { notFound } from "next/navigation";
import { diffWords } from "diff";
import { TailorPanel } from "@/components/tailor-panel";
import { getHubContext } from "@/lib/hub";
import { LIST_LABEL } from "@/lib/jobs/duplicate";
import { setJobResume } from "../actions";

type Change = { kind: string; before: string; after: string; reason: string; requirement?: string };

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const { supabase, current } = await getHubContext();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();
  const role = current!.id === job.hub_id ? current!.role : null;
  const isOwner = role === "owner";

  const [{ data: resumes }, { data: tweaks }] = await Promise.all([
    supabase.from("resumes").select("id, filename").eq("hub_id", job.hub_id).eq("approved", true).order("created_at", { ascending: false }),
    supabase.from("resume_tweaks").select("id, resume_id, original_text, tweaked_text, changes, created_at").eq("job_id", id).order("created_at", { ascending: false }).limit(5),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-muted hover:text-text">← Back to applications</Link>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{job.position}</h1>
          <span className="badge">{LIST_LABEL[job.status]}</span>
          {job.outcome && <span className="badge">{job.outcome === "accepted" ? "Hired" : "Rejected"}</span>}
        </div>
        <p className="text-muted">{job.company}</p>
        <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline break-all">{job.url}</a>
      </div>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Requirements <span className="text-muted">(most wanted first)</span></h2>
        {job.requirements.length === 0 ? <p className="text-sm text-muted">No requirements saved.</p> : (
          <ul className="space-y-2 text-sm">
            {job.requirements.map((r: string, i: number) => (
              <li key={i} className="flex gap-2"><span className="mt-0.5 text-accent">◆</span><span>{r}</span></li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <>
          <section className="card space-y-3">
            <h2 className="text-sm font-semibold">Resume for this application</h2>
            <form action={setJobResume.bind(null, job.id)} className="flex flex-col gap-2 sm:flex-row">
              <select name="resumeId" defaultValue={job.resume_id ?? ""} className="input">
                <option value="">— none selected —</option>
                {(resumes ?? []).map((r) => <option key={r.id} value={r.id}>{r.filename}</option>)}
              </select>
              <button className="btn-ghost shrink-0">Save choice</button>
            </form>
          </section>

          <section className="card space-y-3">
            <h2 className="text-sm font-semibold">AI resume assistant</h2>
            <TailorPanel jobId={job.id} resumes={resumes ?? []} defaultResumeId={job.resume_id} />
          </section>
        </>
      )}

      {(tweaks ?? []).map((t) => (
        <section key={t.id} className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Tailored version · {new Date(t.created_at).toLocaleString()}</h2>
            <a className="btn-ghost" href={`/api/tweaks/${t.id}/docx`}>Download .docx</a>
          </div>
          <div>
            <h3 className="label">What changed vs. your original</h3>
            <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 text-sm leading-relaxed">
              {diffWords(t.original_text, t.tweaked_text).map((p, i) =>
                p.added ? <ins key={i} className="rounded bg-success/20 text-success no-underline">{p.value}</ins>
                : p.removed ? <del key={i} className="rounded bg-danger/20 text-danger">{p.value}</del>
                : <span key={i}>{p.value}</span>)}
            </div>
          </div>
          <div>
            <h3 className="label">Change log</h3>
            <ul className="space-y-2 text-sm">
              {(t.changes as Change[]).map((c, i) => (
                <li key={i} className="rounded-lg border border-border p-3">
                  <span className="badge mr-2">{c.kind}</span>{c.reason}
                  {c.requirement && <span className="text-muted"> — for: {c.requirement}</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
