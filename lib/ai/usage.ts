import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { costUsd, type TokenUsage } from "./pricing";

export type UsageContext = { userId: string; userEmail?: string | null; hubId?: string | null; jobId?: string | null };

const store = new AsyncLocalStorage<UsageContext>();

/** Run `fn` so every Claude call inside it is attributed to this user/hub/job. */
export function withUsage<T>(ctx: UsageContext, fn: () => Promise<T>): Promise<T> {
  return store.run(ctx, fn);
}

/** Persist one call's token usage and estimated cost. Never throws: tracking must not break a feature. */
export async function recordUsage(feature: string, model: string, usage: TokenUsage | undefined | null) {
  const ctx = store.getStore();
  if (!ctx || !usage) return;
  try {
    const { error } = await createAdminClient().from("ai_usage").insert({
      user_id: ctx.userId,
      user_email: ctx.userEmail ?? null,
      hub_id: ctx.hubId ?? null,
      job_id: ctx.jobId ?? null,
      feature,
      model,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cost_usd: costUsd(model, usage),
    });
    if (error) console.error("[ai-usage] insert failed:", error.message);
  } catch (e) {
    console.error("[ai-usage] failed:", e instanceof Error ? e.message : "unknown error");
  }
}
