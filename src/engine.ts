import { MemorySessionStore, newSession } from "./memory.js";
import { normalizeText } from "./normalize.js";
import type { ConversationSession, CromiOptions, CromiReply, IntentPlugin } from "./types.js";

export interface CromiEngine {
  respond(message: string, sessionId: string): Promise<CromiReply>;
  getSession(sessionId: string): Promise<ConversationSession | null>;
}

/**
 * Provider-neutral orchestration. Intent handlers are injected, not hard-coded.
 * No network access, mutations, automatic purchases, or LLM calls in the core.
 */
export function createCromi(options: CromiOptions): CromiEngine {
  const store = options.store ?? new MemorySessionStore();
  const plugins = [...options.plugins];
  const ids = new Set<string>();
  for (const plugin of plugins) {
    if (!plugin.id || ids.has(plugin.id)) throw new Error("Every intent plugin requires a unique non-empty id");
    ids.add(plugin.id);
  }

  return {
    async getSession(sessionId: string) { return store.read(sessionId); },
    async respond(message: string, sessionId: string) {
      if (!sessionId.trim()) throw new Error("sessionId is required");
      if (typeof message !== "string" || message.length > 10000) throw new Error("Message must be a string of at most 10000 characters");
      const normalized = normalizeText(message);
      const session = (await store.read(sessionId)) ?? newSession(sessionId);
      let selected: IntentPlugin | undefined;
      let best = 0;
      for (const plugin of plugins) {
        const score = plugin.score(message, normalized, session);
        if (!Number.isFinite(score) || score <= 0) continue;
        const ranked = score + (plugin.priority ?? 0) / 1000;
        if (ranked > best) { best = ranked; selected = plugin; }
      }
      const reply = selected
        ? await selected.respond({ input: message, normalized, session, adapter: options.adapter })
        : { intent: "fallback", text: options.fallbackText ?? "No tengo datos suficientes para responder esa consulta." };
      if (!reply || typeof reply.text !== "string" || !reply.intent) throw new Error("Intent plugin returned an invalid response");
      session.turn += 1;
      session.lastIntent = reply.intent;
      if (reply.records?.length) session.lastRecordIds = reply.records.slice(0, 25).map((x) => x.id);
      if (reply.proposedAction) reply.needsConfirmation = true;
      await store.write(session);
      return reply;
    },
  };
}
