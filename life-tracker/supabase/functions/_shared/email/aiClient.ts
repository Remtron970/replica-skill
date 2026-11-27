import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_EMAIL_MODEL, type ClaudeLike } from "./ai.ts";

/**
 * Claude for email analysis, if the server has an ANTHROPIC_API_KEY and the user
 * hasn't turned AI off (Email → settings). Model: EMAIL_MODEL secret, defaulting
 * to claude-opus-5-5; set EMAIL_MODEL=claude-haiku-5-5 for a much cheaper option.
 */
export function aiFor(emailSettings: unknown): { client: ClaudeLike; model: string } | null {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  const off = !!emailSettings && typeof emailSettings === "object" && (emailSettings as { ai?: unknown }).ai === false;
  if (!key || off) return null;
  return { client: new Anthropic({ apiKey: key }) as unknown as ClaudeLike, model: Deno.env.get("EMAIL_MODEL") || DEFAULT_EMAIL_MODEL };
}
