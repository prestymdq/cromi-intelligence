import { normalizeCode, normalizeText } from "./normalize.js";
import type { DataAdapter, IntentPlugin, SearchRecord } from "./types.js";

const LOOKUP = /\b(buscar|busco|busca|encontrar|encontra|mostrame|mostrar|mostra|consultar|consulta|search|find|lookup|show)\b/;
const FOLLOWUP = /^(y )?(el |la |su )?(precio|estado|stock|status|detalle|detalles|informacion|info)( actual)?$/;

/**
 * Generic read-only lookup plugin. Any adapter can represent tickets, products,
 * employees, documents, devices, services, etc. No domain rules in the engine.
 */
export function createLookupPlugin(options: { limit?: number; noun?: string } = {}): IntentPlugin {
  const limit = Math.max(1, Math.min(25, Math.floor(options.limit ?? 5)));
  const noun = options.noun ?? "registros";
  return {
    id: "lookup",
    priority: 0,
    score(input, normalized, session) {
      if (!normalized) return 0;
      if (FOLLOWUP.test(normalized) && session.lastRecordIds.length) return 95;
      return LOOKUP.test(normalized) ? 50 : 0;
    },
    async respond({ input, normalized, session, adapter }) {
      if (!adapter) return { intent: "lookup", text: "No hay una fuente de datos conectada." };
      if (FOLLOWUP.test(normalized) && session.lastRecordIds.length) {
        const record = adapter.getById ? await adapter.getById(session.lastRecordIds[0]!) : null;
        if (!record) return { intent: "lookup", text: "No pude recuperar el registro anterior." };
        return { intent: "lookup", text: describe(record), records: [record] };
      }
      const query = input.replace(/^\s*(buscar|busco|busca|encontrar|encontra|mostrame|mostrar|mostra|consultar|consulta|search|find|lookup|show)\s*/i, "").trim();
      if (!query) return { intent: "lookup", text: "Decime qué " + noun + " necesitás buscar." };
      const found = (await adapter.search(query, limit + 1)).slice(0, limit + 1);
      if (!found.length) return { intent: "lookup", text: "No encontré coincidencias para «" + query + "»." };
      const summary = found.slice(0, limit).map((record) => record.code ? record.code + ": " + record.label : record.label).join("; ");
      const suffix = found.length > limit ? " (primeros " + limit + " resultados)" : "";
      return {
        intent: "lookup",
        text: "Encontré " + (found.length > limit ? "más de " + limit : found.length) + " " + noun + ": " + summary + suffix + ".",
        records: found.slice(0, limit),
      };
    },
  };
}

export function describe(item: SearchRecord): string {
  const fields = Object.entries(item.fields ?? {}).map(([key, value]) => key + ": " + String(value)).join("; ");
  return [item.code, item.label, item.summary, fields].filter(Boolean).join(" — ");
}

/** Example connector for demos and tests; replace with a live API or repository. */
export function createArrayAdapter(records: readonly SearchRecord[]): DataAdapter {
  const copy = records.map((record) => ({ ...record, fields: { ...(record.fields ?? {}) } }));
  return {
    async search(query, limit) {
      const q = normalizeText(query);
      const code = normalizeCode(query);
      return copy.filter((record) =>
        (record.code && normalizeCode(record.code) === code) ||
        normalizeText(record.label).includes(q) ||
        normalizeText(record.summary ?? "").includes(q) ||
        Object.values(record.fields ?? {}).some((value) => normalizeText(String(value)).includes(q))
      ).slice(0, Math.max(0, limit));
    },
    async getById(id) { return copy.find((record) => record.id === id) ?? null; },
  };
}
