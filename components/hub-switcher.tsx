"use client";

import { useTransition } from "react";
import { setHub } from "@/app/(app)/actions";

export function HubSwitcher({ hubs, currentId }: { hubs: { id: string; name: string; role: string }[]; currentId: string }) {
  const [pending, start] = useTransition();
  if (hubs.length < 2) return <span className="text-sm text-muted">{hubs[0]?.name}</span>;
  return (
    <select
      aria-label="Switch hub"
      className="input !w-auto !py-1"
      value={currentId}
      disabled={pending}
      onChange={(e) => start(() => setHub(e.target.value))}
    >
      {hubs.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name} ({h.role})
        </option>
      ))}
    </select>
  );
}
