import Link from "next/link";

export default function VerifyPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-2xl">✉️</div>
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          We sent a verification link. Click it to activate your account, then log in.
        </p>
        <Link href="/login" className="btn-ghost mt-5" data-tip="Go to the log in page">Back to log in</Link>
      </div>
    </main>
  );
}
