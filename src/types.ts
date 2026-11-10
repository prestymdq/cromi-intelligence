/** Purely generic types. No company, retail system or provider is required. */
export type CromiValue = string | number | boolean | null;

export interface SearchRecord {
  id: string;
  label: string;
  code?: string;
  summary?: string;
  fields?: Record<string, CromiValue>;
}

/** Implement this against an API, database, in-memory data or an internal service. */
export interface DataAdapter {
  search(query: string, limit: number): Promise<readonly SearchRecord[]>;
  getById?(id: string): Promise<SearchRecord | null>;
}

export interface ConversationSession {
  id: string;
  turn: number;
  lastIntent: string | null;
  lastRecordIds: string[];
  /** Small, developer-controlled state. Never use this as a transcript store. */
  data: Record<string, CromiValue>;
}

export interface SessionStore {
  read(id: string): Promise<ConversationSession | null>;
  write(session: ConversationSession): Promise<void>;
}

export interface CromiReply {
  intent: string;
  text: string;
  records?: readonly SearchRecord[];
  /** A suggestion is descriptive only: Cromi does not call writes automatically. */
  proposedAction?: { name: string; payload: Record<string, CromiValue> };
  needsConfirmation?: boolean;
}

export interface IntentContext {
  input: string;
  normalized: string;
  session: ConversationSession;
  adapter?: DataAdapter;
}

export interface IntentPlugin {
  id: string;
  priority?: number;
  /** The highest positive score wins. Zero = not handled. */
  score(input: string, normalized: string, session: Readonly<ConversationSession>): number;
  respond(context: IntentContext): Promise<CromiReply> | CromiReply;
}

export interface CromiOptions {
  plugins: readonly IntentPlugin[];
  adapter?: DataAdapter;
  store?: SessionStore;
  fallbackText?: string;
}
