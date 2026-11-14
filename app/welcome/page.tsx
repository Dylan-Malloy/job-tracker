import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Job Hub — track every application",
  description: "A private, invite-only hub for tracking job applications, tailoring resumes and writing cover letters without inventing a word.",
};

/* ---------- small static "product" mockups (illustrations, not interactive) ---------- */

function Lane({ title, tone, cards }: { title: string; tone: "orange" | "yellow" | "green"; cards: { role: string; co: string; tag?: string }[] }) {
  const t = {
    orange: "border-orange-400/40 text-orange-300 bg-orange-400/10",
    yellow: "border-yellow-400/40 text-yellow-300 bg-yellow-400/10",
    green: "border-green-400/40 text-green-300 bg-green-400/10",
  }[tone];
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className={`rounded-full border px-3 py-1 text-center text-xs font-medium ${t}`}>{title}</div>
      {cards.map((c) => (
        <div key={c.role} className="rounded-lg border border-border bg-surface-2 p-2.5">
          <p className="truncate text-xs font-medium">{c.role}</p>
          <p className="truncate text-[11px] text-muted">{c.co}</p>
          {c.tag && <span className="mt-1.5 inline-block rounded-full border border-green-400/40 px-1.5 text-[10px] text-green-300">{c.tag}</span>}
        </div>
      ))}
    </div>
  );
}

function BoardMock() {
  return (
    <div aria-hidden className="rounded-2xl border border-border bg-surface/80 p-4 shadow-[0_30px_80px_-30px_rgba(139,92,246,0.55)]">
      <div className="mb-3 flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-border" /><i className="h-2.5 w-2.5 rounded-full bg-border" /><i className="h-2.5 w-2.5 rounded-full bg-border" /></div>
      <div className="flex gap-3">
        <Lane title="Not started" tone="orange" cards={[{ role: "Backend Engineer", co: "Northwind Labs" }, { role: "Data Analyst", co: "Acme Corp" }]} />
        <Lane title="In-progress" tone="yellow" cards={[{ role: "Platform Engineer", co: "Harbor Tech" }]} />
        <Lane title="Finished" tone="green" cards={[{ role: "QA Engineer", co: "Pixel Forge", tag: "Hired" }]} />
      </div>
    </div>
  );
}

function Paper({ title, lines, mark }: { title: string; lines: { w: string; hl?: "red" | "green" }[]; mark?: boolean }) {
  return (
    <figure aria-hidden className="space-y-2">
      <figcaption className="text-xs text-muted">{title}</figcaption>
      <div className="aspect-[8.5/11] rounded-md bg-white p-[9%] shadow-lg">
        <div className="mx-auto mb-2 h-2 w-2/5 rounded bg-neutral-800" />
        <div className="mx-auto mb-3 h-1 w-3/5 rounded bg-neutral-300" />
        <div className="space-y-[5px]">
          {lines.map((l, i) => (
            <div key={i} className={`h-1.5 rounded ${mark && l.hl === "green" ? "bg-green-300" : mark && l.hl === "red" ? "bg-red-300" : "bg-neutral-300"}`} style={{ width: l.w }} />
          ))}
        </div>
      </div>
    </figure>
  );
}

function CompareMock() {
  const orig = [{ w: "92%" }, { w: "78%", hl: "red" as const }, { w: "85%", hl: "red" as const }, { w: "70%" }, { w: "88%", hl: "red" as const }, { w: "60%" }, { w: "82%" }, { w: "74%", hl: "red" as const }, { w: "90%" }, { w: "66%" }, { w: "80%" }, { w: "72%" }];
  const tail = [{ w: "92%" }, { w: "84%", hl: "green" as const }, { w: "70%" }, { w: "88%", hl: "green" as const }, { w: "60%" }, { w: "82%" }, { w: "90%" }, { w: "80%", hl: "green" as const }];
  return (
    <div className="grid grid-cols-2 gap-4">
      <Paper title="Your original" lines={orig} mark />
      <Paper title="Tailored · 1 page" lines={tail} mark />
    </div>
  );
}

function Feature({ title, children, visual, flip }: { title: string; children: React.ReactNode; visual: React.ReactNode; flip?: boolean }) {
  return (
    <section className="grid items-center gap-8 py-12 md:grid-cols-2 md:gap-14 md:py-16">
      <div className={flip ? "md:order-2" : ""}>
        <h3 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">{title}</h3>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted">{children}</div>
      </div>
      <div className={flip ? "md:order-1" : ""}>{visual}</div>
    </section>
  );
}

const Check = () => <span aria-hidden className="mr-2 text-accent">✓</span>;

export default function Welcome() {
  return (
    <div className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">📋</span>
          Job Hub
        </div>
        <div className="flex items-center gap-3">
          <span className="badge hidden sm:inline-flex">Invite only</span>
          <Link href="/login" className="btn-ghost" data-tip="Log in if you already have an account" data-tip-end>Log in</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        {/* Hero */}
        <section className="grid items-center gap-10 pb-10 pt-8 md:grid-cols-[1.05fr_1fr] md:gap-14 md:pb-16 md:pt-14">
          <div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl md:text-6xl">
              Every application, on one calm board.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Paste a job link and Job Hub reads it for you. Tailor your resume and draft a cover letter that never claims anything your resume
              doesn&apos;t already say. Then share your progress with the people helping you.
            </p>
            <div className="card mt-7 max-w-xl border-primary/40 bg-primary/5">
              <p className="font-medium">Job Hub is invite only.</p>
              <p className="mt-1 text-sm text-muted">
                Accounts are created from an invite link sent by a hub owner. If you have one, open it to get started. Without an invite you can look around here, but not use the app.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link href="/login" className="btn" data-tip="Already have an account? Log in here">Log in</Link>
                <span className="text-sm text-muted">Have an invite? Open the link you were sent.</span>
              </div>
            </div>
          </div>
          <BoardMock />
        </section>

        <div className="divide-y divide-border/60">
          <Feature
            title="Add a job from any link"
            visual={
              <div aria-hidden className="card space-y-3">
                <div className="input !cursor-default text-muted">https://careers.example.com/jobs/senior-backend…</div>
                <ul className="space-y-1.5 text-sm text-muted">
                  <li><Check />Checking whether this job is already in your hub</li>
                  <li><Check />Opening the job page</li>
                  <li><Check />Reading the page and pulling out the job text</li>
                  <li className="text-text"><span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent align-[-1px]" />Asking Claude to find the company, position and requirements…</li>
                </ul>
              </div>
            }
          >
            <p>Paste a link from LinkedIn, Indeed, Glassdoor or a company careers page. Claude pulls out the company, the position and the requirements, and shows you each step while it works.</p>
            <p>If a page can&apos;t be read (a login wall, a blocked site), Job Hub says so and lets you paste the description instead. You review and edit everything before it&apos;s saved.</p>
            <p>Links are cleaned of tracking parameters, so the same job is never saved twice. If it&apos;s already in your hub, a red banner tells you which list it&apos;s in.</p>
          </Feature>

          <Feature
            flip
            title="Three lists that match how applying really goes"
            visual={
              <div aria-hidden className="card space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-orange-400/40 px-3 py-1 text-xs text-orange-300">Not started 2</span>
                  <span className="rounded-full border border-yellow-400/40 px-3 py-1 text-xs text-yellow-300">In-progress 3</span>
                  <span className="rounded-full border border-green-400 bg-green-400/20 px-3 py-1 text-xs text-green-100">Finished 5</span>
                </div>
                <p className="text-xs text-muted">Show: <span className="rounded bg-surface-2 px-1.5 py-0.5 text-accent">Hirings</span> Rejections All</p>
                {[["QA Engineer", "Pixel Forge", "Hired", "green"], ["Support Analyst", "Brightside", "Hired", "green"], ["Backend Engineer", "Harbor Tech", "Rejected", "red"]].map(([r, c, t, k]) => (
                  <div key={r} className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2">
                    <div><p className="font-medium">{r}</p><p className="text-xs text-muted">{c}</p></div>
                    <span className={`badge ${k === "green" ? "!border-green-400/40 !text-green-300" : "!border-red-400/40 !text-red-300"}`}>{t}</span>
                  </div>
                ))}
              </div>
            }
          >
            <p><strong className="font-medium text-orange-300">Not started</strong> holds new offers waiting for you. After you apply, move one to <strong className="font-medium text-yellow-300">In-progress</strong>. When it ends, it goes to <strong className="font-medium text-green-300">Finished</strong> as a hiring or a rejection.</p>
            <p>Sort or filter Finished by hirings or rejections. Open any job to see its requirements, most-wanted first.</p>
          </Feature>

          <Feature
            title="A private bank for your resumes"
            visual={
              <div aria-hidden className="card space-y-2 text-sm">
                {[["Alex-Morgan-Resume.docx", "Approved", "text-green-300 border-green-400/40"], ["Alex-Morgan-2026.pdf", "Approved", "text-green-300 border-green-400/40"], ["Helper-upload.pdf", "Pending owner approval", "text-yellow-300 border-yellow-400/40"]].map(([n, s, c]) => (
                  <div key={n} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
                    <span className="truncate">{n}</span><span className={`badge shrink-0 ${c}`}>{s}</span>
                  </div>
                ))}
              </div>
            }
          >
            <p>Upload as many resumes as you like (.docx or .pdf only; anything else is rejected, even if it&apos;s been renamed). Files are private to your hub.</p>
            <p>Pick which resume you&apos;re using for each application. Resumes uploaded by a helper stay unusable until you approve them.</p>
          </Feature>

          <Feature
            flip
            title="A resume tailor that never makes things up"
            visual={<CompareMock />}
          >
            <p>Pick a job and a resume. The assistant rewords, reorders, emphasizes and trims what is already true in your resume to match the job&apos;s most-wanted requirements. It will not add skills, titles, dates or numbers you don&apos;t have.</p>
            <ul className="space-y-1.5">
              <li><Check />Always one page, measured, not guessed</li>
              <li><Check />Every line fact-checked against your original, with retries when something unsupported slips in</li>
              <li><Check />Side-by-side PDFs of your original and the tailored version, with the changes highlighted</li>
              <li><Check />Download as PDF or Word (.docx)</li>
            </ul>
            <p>You see a live checklist of what it&apos;s doing the whole time.</p>
          </Feature>

          <Feature
            title="Cover letters from the same facts"
            visual={
              <div aria-hidden className="mx-auto w-full max-w-xs">
                <Paper title="Cover letter · 1 page" lines={[{ w: "40%" }, { w: "30%" }, { w: "55%" }, { w: "95%" }, { w: "90%" }, { w: "96%" }, { w: "70%" }, { w: "94%" }, { w: "88%" }, { w: "92%" }, { w: "60%" }, { w: "35%" }]} />
              </div>
            }
          >
            <p>Generate a one-page letter for a specific job from your tailored resume or any approved resume. Choose a professional, warm or concise tone, and add notes if there&apos;s something only you know.</p>
            <p>The same rule applies: only what your resume supports. It&apos;s fact-checked before you see it, and you can download it as PDF or .docx, or copy the text.</p>
          </Feature>

          <Feature
            flip
            title="Share your hub, keep control"
            visual={
              <div aria-hidden className="card overflow-hidden !p-0 text-sm">
                <div className="grid grid-cols-3 border-b border-border bg-surface-2 px-4 py-2 text-xs text-muted"><span /><span>View-only</span><span>Helper</span></div>
                {[["See the hub", "✓", "✓"], ["Add job offers", "—", "✓"], ["Upload resumes", "—", "✓ (needs approval)"], ["Use the AI tools", "—", "—"]].map(([a, b, c]) => (
                  <div key={a} className="grid grid-cols-3 border-b border-border/60 px-4 py-2 last:border-0"><span>{a}</span><span className="text-muted">{b}</span><span className="text-muted">{c}</span></div>
                ))}
              </div>
            }
          >
            <p>Invite someone with a one-time link and pick a role: view-only to follow along, or helper to add job offers and upload resumes. Only you can move applications along or use the AI assistant.</p>
            <p>Revoke anyone&apos;s access at any time, and it takes effect immediately. Permissions are enforced in the database, not just hidden in the interface.</p>
          </Feature>
        </div>

        {/* Closing */}
        <section className="my-12 rounded-2xl border border-border bg-surface/70 p-8 text-center md:my-16 md:p-12">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Job Hub is by invitation</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted">
            If a hub owner sent you an invite link, open it to create your account. Already have an account?
          </p>
          <Link href="/login" className="btn mt-6" data-tip="Log in to your hub">Log in</Link>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted">Job Hub · private and invite only</footer>
    </div>
  );
}
