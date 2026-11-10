import { normalizeText } from "./normalize.js";
import type { IntentPlugin } from "./types.js";

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  /** Extra expressions visitors might use for the same question. */
  aliases?: readonly string[];
}

const STOP = new Set([
  "a", "al", "de", "del", "el", "en", "es", "la", "las", "lo", "los",
  "me", "mi", "mis", "por", "que", "se", "son", "su", "sus", "un",
  "una", "unas", "unos", "y", "para", "puedo", "pueden", "tengo",
  "cual", "cuales", "como", "cuando", "cuanto", "cuantos", "donde",
  "hay", "tienen", "tiene", "quiero", "saber", "informacion", "sobre",
]);

function terms(value: string) {
  return [...new Set(normalizeText(value).split(" ").filter((word) => word.length > 2 && !STOP.has(word)))];
}

function relevance(raw: string, phrase: string) {
  const input = normalizeText(raw);
  const expected = normalizeText(phrase);
  if (!input || !expected) return 0;
  if (input === expected) return 100;
  if ((" " + input + " ").includes(" " + expected + " ")) return 85;
  const wanted = terms(expected);
  if (wanted.length < 2) return 0;
  const got = new Set(terms(input));
  const hits = wanted.filter((word) => got.has(word)).length;
  return hits >= 2 && hits / wanted.length >= 0.8 ? 45 + hits : 0;
}

export function createFaqPlugin(entries: readonly FaqEntry[]): IntentPlugin {
  const items = entries.map((entry) => ({
    ...entry,
    phrases: [entry.question, ...(entry.aliases ?? [])],
  }));
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id || ids.has(item.id) || !item.question.trim() || !item.answer.trim()) {
      throw new Error("FAQ entries require unique IDs and non-empty questions and answers");
    }
    ids.add(item.id);
  }

  function findBest(input: string) {
    let selected: typeof items[number] | null = null;
    let best = 0;
    for (const item of items) {
      const score = Math.max(...item.phrases.map((phrase) => relevance(input, phrase)));
      if (score > best) { selected = item; best = score; }
    }
    return { item: selected, score: best };
  }

  return {
    id: "faq",
    priority: 2,
    score: (input) => findBest(input).score,
    respond({ input, session }) {
      const match = findBest(input).item;
      if (!match) return { intent: "faq", text: "No encontré información sobre esa consulta." };
      session.data.lastFaqId = match.id;
      return { intent: "faq", text: match.answer };
    },
  };
}
