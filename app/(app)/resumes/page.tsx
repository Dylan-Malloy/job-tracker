import { ResumeUpload } from "@/components/resume-upload";
import { getHubContext } from "@/lib/hub";
import { deleteResume, setResumeApproval } from "./actions";

export default async function ResumesPage() {
  const { supabase, current } = await getHubContext();
  const hub = current!;
  const { data: resumes } = await supabase
    .from("resumes")
    .select("id, filename, kind, approved, created_at")
    .eq("hub_id", hub.id)
    .order("created_at", { ascending: false });
  const canUpload = hub.role !== "viewer";
  const isOwner = hub.role === "owner";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resume bank</h1>
        <p className="text-sm text-muted">Private to this hub. Pick one of the approved resumes for each application.</p>
      </div>
      {canUpload && <ResumeUpload hubId={hub.id} isOwner={isOwner} />}
      <div className="space-y-3">
        {(resumes ?? []).length === 0 && <p className="card text-center text-sm text-muted">No resumes yet.</p>}
        {(resumes ?? []).map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.filename}</p>
              <p className="text-xs text-muted">{r.kind.toUpperCase()} · {new Date(r.created_at).toLocaleDateString()}</p>
            </div>
            {r.approved
              ? <span className="badge !border-success/40 !text-success">Approved</span>
              : <span className="badge !border-warn/40 !text-warn">Pending owner approval</span>}
            <a className="btn-ghost" href={`/api/resumes/${r.id}/download`}>Download</a>
            {isOwner && !r.approved && (
              <form action={setResumeApproval.bind(null, r.id, true)}><button className="btn">Approve</button></form>
            )}
            {isOwner && r.approved && (
              <form action={setResumeApproval.bind(null, r.id, false)}><button className="btn-ghost">Revoke approval</button></form>
            )}
            {isOwner && <form action={deleteResume.bind(null, r.id)}><button className="btn-danger">Delete</button></form>}
          </div>
        ))}
      </div>
    </div>
  );
}
