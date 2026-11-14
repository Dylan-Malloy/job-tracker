import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { isAdminUser } from "@/lib/admin/guard";
import { getHubContext } from "@/lib/hub";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, hubs, current } = await getHubContext();
  if (!current) redirect("/login");
  const isAdmin = await isAdminUser(user.id);
  return (
    <>
      <Header hubs={hubs} current={current} email={user.email ?? ""} isAdmin={isAdmin} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
