import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { HubSwitcher } from "./hub-switcher";
import type { HubInfo } from "@/lib/hub";

export function Header({ hubs, current, email, isAdmin }: { hubs: HubInfo[]; current: HubInfo; email: string; isAdmin?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold" data-tip="Go to your applications">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">📋</span>
          Job Hub
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link href="/" className="hover:text-text" data-tip="Your NOT STARTED, IN-PROGRESS and FINISHED lists">Applications</Link>
          <Link href="/resumes" className="hover:text-text" data-tip="Upload and manage resumes (.pdf or .docx)">Resumes</Link>
          {current.role === "owner" && <Link href="/sharing" className="hover:text-text" data-tip="Invite helpers or viewers and revoke access">Sharing</Link>}
          {isAdmin && <Link href="/admin" className="text-accent hover:text-text" data-tip="Analytics, AI spend, helpers and users">Admin</Link>}
          <Link href="/account" className="hover:text-text" data-tip="Change your password">Account</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <HubSwitcher hubs={hubs} currentId={current.id} />
          <span className="badge hidden sm:inline-flex">{current.role}</span>
          <span className="hidden text-xs text-muted md:inline">{email}</span>
          <form action={logout}>
            <button className="btn-ghost" data-tip="Sign out of your account" data-tip-end>Log out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
