import { StatCard } from "@/components/admin/stat-card";
import { getHubContext } from "@/lib/hub";
import { fmtDate, fmtDateTime, getTimeZone } from "@/lib/tz";
import { removeMember, setMemberRole } from "./actions";

export default async function HelpersPage() {
  const { supabase, hubs } = await getHubContext();
  const tz = await getTimeZone();
  const own = hubs.find((h) => h.role === "owner");
  if (!own) return <p className="card text-sm text-muted">You don&apos;t own a hub yet.</p>;

  const [{ data: members }, { data: jobs }, { data: resumes }, { data: invites }] = await Promise.all([
    supabase.from("hub_members").select("id, user_id, role, member_email, created_at").eq("hub_id", own.id).order("created_at"),
    supabase.from("jobs").select("added_by, created_at").eq("hub_id", own.id),
    supabase.from("resumes").select("uploaded_by, approved, created_at").eq("hub_id", own.id),
    supabase.from("hub_invites").select("id").eq("hub_id", own.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()),
  ]);

  const stats = (userId: string) => {
    const j = (jobs ?? []).filter((x) => x.added_by === userId);
    const r = (resumes ?? []).filter((x) => x.uploaded_by === userId);
    const times = [...j, ...r].map((x) => x.created_at).sort();
    return { jobs: j.length, resumes: r.length, pending: r.filter((x) => !x.approved).length, last: times[times.length - 1] ?? null };
  };
  const list = members ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="People with access" value={String(list.length)} />
        <StatCard label="Helpers" value={String(list.filter((m) => m.role === "helper").length)} />
        <StatCard label="Viewers" value={String(list.filter((m) => m.role === "viewer").length)} />
        <StatCard label="Pending invites" value={String((invites ?? []).length)} hint="manage on the Sharing page" />
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Helpers and viewers on {own.name}</h2>
        {list.length === 0 ? <p className="text-sm text-muted">Nobody has joined yet. Create an invite on the Sharing page.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>{["Person", "Role", "Joined", "Jobs added", "Resumes uploaded", "Last activity", ""].map((h) => <th key={h} className="pb-2 pr-4 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.map((m) => {
                const s = stats(m.user_id);
                return (
                  <tr key={m.id} className="border-t border-border/60 align-middle">
                    <td className="py-2.5 pr-4">{m.member_email ?? "Unknown"}</td>
                    <td className="py-2.5 pr-4">
                      <form action={setMemberRole.bind(null, m.id)} className="flex items-center gap-2">
                        <select name="role" defaultValue={m.role} className="input !w-auto !py-1" aria-label={`Role for ${m.member_email}`}>
                          <option value="helper">Helper</option>
                          <option value="viewer">View-only</option>
                        </select>
                        <button className="btn-ghost !py-1" data-tip="Save this person's new role — it takes effect immediately">Save</button>
                      </form>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-muted">{fmtDate(m.created_at, tz)}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{s.jobs}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{s.resumes}{s.pending ? <span className="ml-2 badge !border-yellow-400/40 !text-yellow-300">{s.pending} pending</span> : null}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-muted">{s.last ? fmtDateTime(s.last, tz) : "—"}</td>
                    <td className="py-2.5 text-right">
                      <form action={removeMember.bind(null, m.id)}>
                        <button className="btn-danger !py-1" data-tip="Remove this person's access immediately" data-tip-end>Revoke</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
