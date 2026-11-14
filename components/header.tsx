import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { HubSwitcher } from "./hub-switcher";
import type { HubInfo } from "@/lib/hub";

export function Header({ hubs, current, email }: { hubs: HubInfo[]; current: HubInfo; email: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">📋</span>
          Job Hub
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link href="/" className="hover:text-text">Applications</Link>
          <Link href="/resumes" className="hover:text-text">Resumes</Link>
          {current.role === "owner" && <Link href="/sharing" className="hover:text-text">Sharing</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <HubSwitcher hubs={hubs} currentId={current.id} />
          <span className="badge hidden sm:inline-flex">{current.role}</span>
          <span className="hidden text-xs text-muted md:inline">{email}</span>
          <form action={logout}>
            <button className="btn-ghost">Log out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
