import { UsersTable } from "@/components/admin/users-table";
import { fetchUsers } from "@/lib/admin/data";
import { getHubContext } from "@/lib/hub";
import { fmtDate, fmtDateTime, getTimeZone } from "@/lib/tz";

export default async function UsersPage() {
  const { user, hubs } = await getHubContext();
  const tz = await getTimeZone();
  const own = hubs.find((h) => h.role === "owner");
  const users = await fetchUsers(user.id, own?.id ?? null);
  return (
    <UsersTable
      selfId={user.id}
      users={users.map((u) => ({
        ...u,
        createdLabel: fmtDate(u.createdAt, tz),
        lastLabel: u.lastSignInAt ? fmtDateTime(u.lastSignInAt, tz) : "Never",
      }))}
    />
  );
}
