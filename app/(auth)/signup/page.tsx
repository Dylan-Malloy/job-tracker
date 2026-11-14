import { AuthForm } from "@/components/auth-form";
import { signup } from "../actions";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return <AuthForm mode="signup" action={signup} next={next} />;
}
