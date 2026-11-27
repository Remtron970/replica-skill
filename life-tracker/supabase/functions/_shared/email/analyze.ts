import { analyzeWithClaude, type ClaudeLike } from "./ai.ts";
import type { AnalysisContext, EmailAnalysis, ParsedEmail } from "./model.ts";
import { analyzeWithRules } from "./rules.ts";

/** AI when available, otherwise (or if it fails) the built-in rules. Never throws. */
export async function analyzeEmail(email: ParsedEmail, ctx: AnalysisContext, ai?: { client: ClaudeLike; model: string } | null): Promise<EmailAnalysis> {
  if (ai) {
    try {
      const a = await analyzeWithClaude(ai.client, ai.model, email, ctx);
      if (a) return a;
    } catch {
      /* network/API error: fall through to rules */
    }
  }
  return analyzeWithRules(email, ctx);
}
