import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareViewer } from "@/components/compare-viewer";
import { CoverLetterPanel } from "@/components/cover-letter-panel";
import { LetterViewer } from "@/components/letter-viewer";
import { TailorPanel } from "@/components/tailor-panel";
import { getHubContext } from "@/lib/hub";
import { LIST_LABEL } from "@/lib/jobs/duplicate";
import { fmtDateTime, getTimeZone } from "@/lib/tz";
import { setJobResume } from "../actions";

type Change = { kind: string; before: string; after: string; reason: string; requirement?: string };

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const tz = await getTimeZone();
  const { supabase, current } = await getHubContext();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();
  const role = current!.id === job.hub_id ? current!.role : null;
  const isOwner = role === "owner";

  const [{ data: resumes }, { data: tweaks }, { data: letters }] = await Promise.all([
    supabase.from("resumes").select("id, filename").eq("hub_id", job.hub_id).eq("approved", true).order("created_at", { ascending: false }),
    supabase.from("resume_tweaks").select("id, resume_id, changes, created_at, tailored_resume").eq("job_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("cover_letters").select("id, body_text, source_label, created_at").eq("job_id", id).order("created_at", { ascending: false }).limit(5),
  ]);
  const results = (tweaks ?? []).filter((t) => t.tailored_resume);
  const letterSources = [
    ...(results[0] ? [{ value: `tweak:${results[0].id}`, label: "Latest tailored resume for this job (recommended)" }] : []),
    ...(resumes ?? []).map((r) => ({ value: `resume:${r.id}`, label: r.filename })),
  ];

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-muted hover:text-text" data-tip="Return to your application lists">← Back to applications</Link>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{job.position}</h1>
          <span className="badge">{LIST_LABEL[job.status]}</span>
          {job.outcome && <span className="badge">{job.outcome === "accepted" ? "Hired" : "Rejected"}</span>}
        </div>
        <p className="text-muted">{job.company}</p>
        <a href={job.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-accent hover:underline">{job.url}</a>
      </div>

      {isOwner && (
        <section className="card space-y-3 border-primary/50 shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_12px_40px_-16px_rgba(139,92,246,0.5)]">
          <div>
            <h2 className="text-lg font-semibold">AI resume assistant</h2>
            <p className="text-sm text-muted">Tailor a resume to this job in one click.</p>
          </div>
          <TailorPanel jobId={job.id} resumes={resumes ?? []} defaultResumeId={job.resume_id} />
        </section>
      )}

      {results.map((t, idx) => (
        <section key={t.id} className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {idx === 0 ? "Latest tailored resume" : "Earlier version"} · {fmtDateTime(t.created_at, tz)}
            </h2>
            <div className="flex gap-2">
              <a className="btn" href={`/api/tweaks/${t.id}/pdf?view=tailored&download=1`} data-tip="Download the tailored resume as a one-page PDF">Download PDF</a>
              <a className="btn-ghost" href={`/api/tweaks/${t.id}/docx`} data-tip="Download the tailored resume as an editable one-page Word file">Download .docx</a>
            </div>
          </div>
          {idx === 0 ? (
            <CompareViewer tweakId={t.id} />
          ) : (
            <details>
              <summary className="cursor-pointer text-sm text-accent">Compare with your original</summary>
              <div className="mt-3"><CompareViewer tweakId={t.id} /></div>
            </details>
          )}
          <details open={idx === 0}>
            <summary className="cursor-pointer text-sm font-medium">What changed ({(t.changes as Change[]).length})</summary>
            <ul className="mt-3 space-y-2 text-sm">
              {(t.changes as Change[]).map((c, i) => (
                <li key={i} className="rounded-lg border border-border p-3">
                  <span className="badge mr-2">{c.kind}</span>{c.reason}
                  {c.requirement && <span className="text-muted"> — for: {c.requirement}</span>}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}

      {isOwner && (
        <section className="card space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Cover letter generator</h2>
            <p className="text-sm text-muted">A one-page letter for this job that only uses what&apos;s true in your resume.</p>
          </div>
          <CoverLetterPanel jobId={job.id} sources={letterSources} defaultSource={letterSources[0]?.value ?? ""} />
        </section>
      )}

      {(letters ?? []).map((l, idx) => (
        <section key={l.id} className="card space-y-3">
          <h2 className="text-sm font-semibold">
            {idx === 0 ? "Latest cover letter" : "Earlier cover letter"} · {fmtDateTime(l.created_at, tz)}
            <span className="font-normal text-muted"> · from {l.source_label}</span>
          </h2>
          {idx === 0 ? <LetterViewer id={l.id} text={l.body_text} /> : (
            <details><summary className="cursor-pointer text-sm text-accent">Show this letter</summary><div className="mt-3"><LetterViewer id={l.id} text={l.body_text} /></div></details>
          )}
        </section>
      ))}

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Requirements <span className="font-normal text-muted">(most wanted first)</span></h2>
        {job.requirements.length === 0 ? <p className="text-sm text-muted">No requirements saved.</p> : (
          <ul className="space-y-2 text-sm">
            {job.requirements.map((r: string, i: number) => (
              <li key={i} className="flex gap-2"><span className="mt-0.5 text-accent">◆</span><span>{r}</span></li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <section className="card space-y-3">
          <h2 className="text-sm font-semibold">Resume for this application</h2>
          <form action={setJobResume.bind(null, job.id)} className="flex flex-col gap-2 sm:flex-row">
            <select name="resumeId" defaultValue={job.resume_id ?? ""} className="input" aria-label="Resume for this application">
              <option value="">— none selected —</option>
              {(resumes ?? []).map((r) => <option key={r.id} value={r.id}>{r.filename}</option>)}
            </select>
            <button className="btn-ghost shrink-0" data-tip="Remember which resume you're using for this application">Save choice</button>
          </form>
        </section>
      )}
    </div>
  );
}
