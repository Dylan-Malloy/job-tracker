import { redirect } from "next/navigation";
import { InviteForm } from "@/components/invite-form";
import { getHubContext } from "@/lib/hub";
import { fmtDate, getTimeZone } from "@/lib/tz";
import { revokeInvite, revokeMember } from "./actions";

const ROLE_LABEL: Record<string, string> = { viewer: "View-only", helper: "Helper" };

export default async function SharingPage() {
  const { supabase, user, current } = await getHubContext();
  const hub = current!;
  const tz = await getTimeZone();
  if (hub.role !== "owner") redirect("/");

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("hub_members").select("id, role, member_email, created_at").eq("hub_id", hub.id).order("created_at"),
    supabase.from("hub_invites").select("id, email, role, expires_at").eq("hub_id", hub.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sharing</h1>
        <p className="text-sm text-muted">Control who can see or help with your hub. Revoking takes effect immediately.</p>
      </div>
      <InviteForm hubId={hub.id} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">People with access</h2>
        <div className="card flex items-center gap-3">
          <div className="flex-1">{user.email} <span className="text-xs text-muted">(you)</span></div>
          <span className="badge">Owner</span>
        </div>
        {(members ?? []).map((m) => (
          <div key={m.id} className="card flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 truncate">{m.member_email ?? "Unknown"}</div>
            <span className="badge">{ROLE_LABEL[m.role]}</span>
            <form action={revokeMember.bind(null, m.id)}><button className="btn-danger" data-tip="Remove this person's access immediately" data-tip-end>Revoke access</button></form>
          </div>
        ))}
      </section>

      {(invites ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Pending invites</h2>
          {(invites ?? []).map((i) => (
            <div key={i.id} className="card flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 truncate">{i.email}</div>
              <span className="badge">{ROLE_LABEL[i.role]}</span>
              <span className="text-xs text-muted">expires {fmtDate(i.expires_at, tz)}</span>
              <form action={revokeInvite.bind(null, i.id)}><button className="btn-danger" data-tip="Cancel this invite so its link stops working" data-tip-end>Cancel</button></form>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
