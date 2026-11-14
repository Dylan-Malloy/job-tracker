import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "./usage";

let client: Anthropic | null = null;
export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
  return (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
}
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

/** Every Claude call in the app goes through here so tokens and cost are logged per feature. */
export async function createMessage(feature: string, params: Anthropic.MessageCreateParamsNonStreaming) {
  const res = await anthropic().messages.create(params);
  await recordUsage(feature, res.model ?? params.model, res.usage);
  return res;
}
