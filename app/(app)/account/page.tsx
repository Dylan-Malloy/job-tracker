import { ChangePasswordForm } from "@/components/change-password-form";
import { getHubContext } from "@/lib/hub";

export default async function AccountPage() {
  const { user } = await getHubContext();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-muted">Signed in as {user.email}</p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
