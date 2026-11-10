# Integration guide

To embed Cromi into another system, build an adapter returning application records using the generic SearchRecord interface and register your own intent handlers.

## Connect an existing API

The application should supply an adapter implementing DataAdapter:

    import type { DataAdapter } from "cromi-intelligence";

    export const apiAdapter: DataAdapter = {
      async search(query, limit) {
        const results = await yourInternalService.search({ query, limit });
        return results.map((r) => ({
          id: r.id,
          code: r.reference,
          label: r.title,
          fields: { status: r.status },
        }));
      },
      async getById(id) {
        const r = await yourInternalService.getById(id);
        return r ? { id: r.id, label: r.title, fields: { status: r.status } } : null;
      },
    };

The code is illustrative: yourInternalService must be supplied by the integrating application and must enforce its authorization rules.

## Define new intents

    const myPlugin = {
      id: "help",
      score: (_input, normalized) => normalized.includes("ayuda") ? 100 : 0,
      respond: () => ({ intent: "help", text: "¿Qué necesitás consultar?" }),
    };

The router prioritizes the highest intent score. If a plugin proposes a mutation, return proposedAction and let the host verify permission and obtain confirmation before writing anything.

## Production checklist

- Add server-side authentication and per-record authorization (not provided).
- Replace MemorySessionStore with persistent storage if needed.
- Do not log personal conversation content unless required and disclosed.
- Avoid returning sensitive fields in SearchRecord.
- Set request limits, quotas, monitoring and error handling in the host.
- Include domain-specific tests for adapter permissions and ambiguous results.
