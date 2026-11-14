import { AuthForm } from "@/components/auth-form";
import { login } from "../actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return <AuthForm action={login} next={next} />;
}
