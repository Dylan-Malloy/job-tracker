/** USD per million tokens. Source: Anthropic published API pricing (cached 2026-11-03). */
export type Price = { input: number; output: number; cacheWrite: number; cacheRead: number };
export const PRICING_AS_OF = "2026-11-03";

export const PRICES: Record<string, Price> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  "claude-fable-5-2": { input: 8, output: 40, cacheWrite: 10, cacheRead: 0.2 },
};
const FALLBACK = PRICES["claude-sonnet-5-5"];

export type TokenUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export function priceFor(model: string): { price: Price; known: boolean } {
  if (PRICES[model]) return { price: PRICES[model], known: true };
  const prefix = Object.keys(PRICES).find((k) => model.startsWith(k));
  return prefix ? { price: PRICES[prefix], known: true } : { price: FALLBACK, known: false };
}

/** Estimated cost in USD, rounded to 6 decimals. Unknown models are priced like Sonnet 5.5. */
export function costUsd(model: string, u: TokenUsage): number {
  const { price } = priceFor(model);
  const cost =
    ((u.input_tokens ?? 0) * price.input +
      (u.output_tokens ?? 0) * price.output +
      (u.cache_creation_input_tokens ?? 0) * price.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * price.cacheRead) /
    1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}
