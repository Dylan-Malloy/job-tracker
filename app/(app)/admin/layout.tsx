import { AdminTabs } from "@/components/admin/admin-tabs";
import { requireAdmin } from "@/lib/admin/guard";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted">Only site admins can see this area.</p>
      </div>
      <AdminTabs />
      {children}
    </div>
  );
}
