import Link from "next/link";
import { deleteJob, moveJob } from "@/app/(app)/actions";

type Job = {
  id: string; url: string; company: string; position: string;
  status: string; outcome: string | null; requirements: string[];
};

export function JobCard({ job, isOwner }: { job: Job; isOwner: boolean }) {
  return (
    <article className="card flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/jobs/${job.id}`} className="truncate font-medium hover:text-accent">{job.position}</Link>
          {job.outcome === "accepted" && <span className="badge !border-success/40 !text-success">Hired</span>}
          {job.outcome === "denied" && <span className="badge !border-danger/40 !text-danger">Rejected</span>}
        </div>
        <p className="truncate text-sm text-muted">{job.company}</p>
        <a href={job.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-accent/80 hover:underline">{job.url}</a>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/jobs/${job.id}`} className="btn-ghost" data-tip="See the requirements and tailor a resume for this job">Requirements ({job.requirements.length})</Link>
        {isOwner && job.status === "not_started" && (
          <form action={moveJob.bind(null, job.id, "in_progress")}><button className="btn" data-tip="Move this job to IN-PROGRESS — you've submitted your application">I applied →</button></form>
        )}
        {isOwner && job.status === "in_progress" && (
          <>
            <form action={moveJob.bind(null, job.id, "accepted")}><button className="btn" data-tip="You got the job — move to FINISHED as a hiring">Accepted</button></form>
            <form action={moveJob.bind(null, job.id, "denied")}><button className="btn-ghost" data-tip="You were turned down — move to FINISHED as a rejection">Denied</button></form>
          </>
        )}
        {isOwner && job.status !== "not_started" && (
          <form action={moveJob.bind(null, job.id, job.status === "finished" ? "in_progress" : "not_started")}>
            <button className="btn-ghost" aria-label="Move back" data-tip={job.status === "finished" ? "Reopen — move back to IN-PROGRESS" : "Move back to NOT STARTED"}>↩</button>
          </form>
        )}
        {isOwner && (
          <form action={deleteJob.bind(null, job.id)}><button className="btn-danger" aria-label="Delete job" data-tip="Delete this job permanently" data-tip-end>✕</button></form>
        )}
      </div>
    </article>
  );
}
