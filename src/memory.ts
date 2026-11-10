import type { ConversationSession, SessionStore } from "./types.js";

export function newSession(id: string): ConversationSession {
  return { id, turn: 0, lastIntent: null, lastRecordIds: [], data: {} };
}

/** In-memory reference implementation. Use Redis/DB for production scaling. */
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, ConversationSession>();

  async read(id: string): Promise<ConversationSession | null> {
    const current = this.sessions.get(id);
    return current ? structuredClone(current) : null;
  }

  async write(session: ConversationSession): Promise<void> {
    this.sessions.set(session.id, structuredClone(session));
  }
}
