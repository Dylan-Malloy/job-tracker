/** Lightweight server-rendered charts (no client JS). Each bar carries a title for hover and screen readers. */

export type Series = { name: string; color: string };
export type Point = { label: string; values: number[] };

export function ColumnChart({ points, series, format = (n) => String(n), height = 160, labelEvery = 1 }: {
  points: Point[]; series: Series[]; format?: (n: number) => string; height?: number; labelEvery?: number;
}) {
  const max = Math.max(1e-9, ...points.flatMap((p) => p.values));
  const nice = (m: number) => { const e = 10 ** Math.floor(Math.log10(m)); const f = m / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };
  const top = nice(max);
  return (
    <figure>
      <div className="relative" style={{ height }} role="img" aria-label={`Chart: ${series.map((s) => s.name).join(", ")} by period`}>
        {[0, 0.5, 1].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-border/60" style={{ bottom: `${g * 100}%` }}>
            <span className="absolute -top-2 left-0 bg-surface pr-1 text-[10px] text-muted">{format(top * g)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-1 pl-9">
          {points.map((p) => (
            <div key={p.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px"
              title={`${p.label}: ${series.map((s, i) => `${s.name} ${format(p.values[i] ?? 0)}`).join(", ")}`}>
              {p.values.map((v, i) => (
                <div key={i} className="w-full max-w-[18px] rounded-t-sm" style={{ height: `${Math.max(v > 0 ? 2 : 0, (v / top) * 100)}%`, background: series[i].color }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-1 pl-9 text-[10px] text-muted">
        {points.map((p, i) => <span key={p.label} className="flex min-w-0 flex-1 justify-center"><span className="whitespace-nowrap">{i % labelEvery === 0 ? p.label : ""}</span></span>)}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-9 text-xs text-muted">
        {series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.name}</span>)}
      </figcaption>
    </figure>
  );
}

export function BarList({ items, format = (n) => String(n), color = "var(--primary)", empty = "Nothing here yet." }: {
  items: { label: string; value: number; sub?: string }[]; format?: (n: number) => string; color?: string; empty?: string;
}) {
  const max = Math.max(1e-9, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="shrink-0 tabular-nums text-muted">{format(i.value)}{i.sub ? <span className="ml-2 text-xs">{i.sub}</span> : null}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
