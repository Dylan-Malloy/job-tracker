export function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-green-300" : tone === "bad" ? "text-red-300" : tone === "warn" ? "text-yellow-300" : "text-text";
  return (
    <div className="card !p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
