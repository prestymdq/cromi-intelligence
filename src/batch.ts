import { normalizeCode, normalizeText } from "./normalize.js";
import type { DataAdapter, IntentPlugin, SearchRecord } from "./types.js";

export type BatchMatchStatus = "matched" | "duplicate" | "ambiguous" | "not-found";
export interface BatchMatch {
  input: string;
  status: BatchMatchStatus;
  record?: SearchRecord;
  alternatives?: readonly SearchRecord[];
}

/** Generic list resolver: tickets, documents, products, devices or references. */
export async function resolveBatch(
  input: string,
  adapter: DataAdapter,
  options: { maxEntries?: number } = {},
): Promise<BatchMatch[]> {
  const lines = input.split(/\r?\n|;/).map((line) => line.trim()).filter(Boolean);
  const limit = options.maxEntries ?? 500;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("maxEntries must be a positive integer");
  if (lines.length > limit) throw new Error("List exceeds the allowed number of entries");
  const matches: BatchMatch[] = [];
  const seen = new Set<string>();
  for (let start = 0; start < lines.length; start += 8) {
    const chunk = lines.slice(start, start + 8);
    const found = await Promise.all(chunk.map((query) => adapter.search(query, 20)));
    for (let j = 0; j < chunk.length; j++) {
      const query = chunk[j]!;
      const candidates = found[j] ?? [];
      const exact = candidates.filter((item) =>
        (item.code && normalizeCode(item.code) === normalizeCode(query)) ||
        normalizeText(item.label) === normalizeText(query)
      );
      const unique = [...new Map(exact.map((item) => [item.id, item])).values()];
      if (unique.length > 1) matches.push({ input: query, status: "ambiguous", alternatives: unique });
      else if (!unique.length) matches.push({ input: query, status: "not-found" });
      else {
        const record = unique[0]!;
        if (seen.has(record.id)) matches.push({ input: query, status: "duplicate", record });
        else { seen.add(record.id); matches.push({ input: query, status: "matched", record }); }
      }
    }
  }
  return matches;
}

/** Optional plugin for multiline or semicolon-separated identifier lists. */
export function createBatchPlugin(): IntentPlugin {
  return {
    id: "batch",
    priority: 10,
    score(input) {
      const entries = input.split(/\r?\n|;/).filter((value) => value.trim());
      return entries.length >= 2 ? 100 : 0;
    },
    async respond({ input, session, adapter }) {
      if (!adapter) return { intent: "batch", text: "No hay una fuente de datos conectada." };
      const matches = await resolveBatch(input, adapter);
      const records = matches.filter((x) => x.status === "matched").map((x) => x.record!);
      const count = (status: BatchMatchStatus) => matches.filter((x) => x.status === status).length;
      session.data.lastBatchTotal = matches.length;
      return {
        intent: "batch",
        text: "Analicé " + matches.length + " entradas: " + count("matched") + " encontradas, " + count("duplicate") + " repetidas, " + count("ambiguous") + " ambiguas y " + count("not-found") + " sin coincidencia. No modifiqué ningún dato.",
        records: records.slice(0, 25),
      };
    },
  };
}
