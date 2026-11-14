"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Remembers the browser's time zone in a cookie so the server can show dates in the user's local time. */
export function TimezoneSync() {
  const router = useRouter();
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      const current = document.cookie.split("; ").find((c) => c.startsWith("tz="))?.slice(3);
      if (current && decodeURIComponent(current) === tz) return;
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh(); // re-render server components with the right zone
    } catch {
      /* cookies or Intl unavailable: stay on UTC */
    }
  }, [router]);
  return null;
}
