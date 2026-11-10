# Cromi Intelligence

**A reusable, framework-agnostic conversational engine for business software.**

Cromi provides deterministic intent routing, short-lived session context, extensible plugins and read-only data adapters. It can integrate with **support desks, ERPs, CRMs, inventory systems, booking platforms or custom applications**. The engine itself does **not** require an LLM, API key, cloud account, database or specific framework.

This is an **independent public core**, not a complete enterprise platform. Integrations, persistence and real data sources are implemented by the adopting application.

## Run

Requires Node.js 20+.

```bash
npm install
npm test
npm run demo
```

## Quick start

```ts
import { createCromi, createArrayAdapter, createLookupPlugin } from "cromi-intelligence";

const engine = createCromi({
  adapter: createArrayAdapter([
    { id: "t-42", code: "SUP 42", label: "Login issue", fields: { status: "open" } },
  ]),
  plugins: [createLookupPlugin({ noun: "tickets" })],
});

const first = await engine.respond("buscar SUP 42", "session-a");
const next = await engine.respond("y el estado", "session-a");
console.log(first.text, next.text);
```

## Architecture

```text
Your website / mobile app / API
             |
        createCromi
             |
   Deterministic intent router
             |
    Pluggable intent handlers
             |
      DataAdapter interface
             |
    Your database or service
```

- **Core:** `src/engine.ts` scores intents, dispatches handlers and updates a session.
- **Plugins:** `src/plugins.ts` includes an optional generic lookup example and an in-memory adapter.
- **Memory:** `src/memory.ts` is a replaceable session store; the demo is ephemeral.
- **Normalization:** `src/normalize.ts` manages accents and identifiers.
- **Examples:** `examples/demo.mjs` demonstrates two unrelated systems on the same core.
- **Tests:** `tests/engine.test.mjs` verifies routing, context, isolation and confirmation signals.

The public core exposes the types `IntentPlugin`, `DataAdapter`, and `SessionStore` so each system can provide its own rules, integrations and persistence without changing Cromi itself.

## Safety and operational boundaries

- Data access is **read-only** in the supplied adapter.
- `proposedAction` describes a possible operation. **No actions are executed by this package.** The host must implement authorization and explicit user confirmation.
- Keep API keys, database credentials and sensitive data **in your host application**, never in the browser or this repository.
- The in-memory session store is not suitable for clustered production or durable state. Implement `SessionStore` backed by an authorized database/Redis if needed.
- Add authentication, authorization, per-tenant isolation, rate limiting, audit logs and a privacy policy before use with real user data.
- The engine is **rule-based**, not a trained neural model. NLP/vision/LLM providers can be added as plugins; none are bundled or required.

## License

MIT. See [LICENSE](LICENSE). Contributions and integrations are welcome.


## Optional batch import

Register `createBatchPlugin()` to analyze multiline or semicolon-separated lists against any adapter. The resolver detects exact identifiers, duplicates, ambiguous labels and unresolved entries. It processes up to 500 entries, in bounded batches, without writing to the host system.

This library is not published to npm yet. For now, clone the repository and build it, or reference it as a local package in your application.

## Floating chat widget

Cromi now includes a **framework-free, customizable chat bubble** in `widget/`, with an independent CSS file and an isolated Shadow DOM interface.

Try the interactive demo:

```bash
npm install
npm run demo:widget
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173) to test the floating chat and change its name, theme, accent color and position.

A new `createFaqPlugin()` provides **topic-specific customer information** without an LLM, cloud APIs or extra cost. To use the widget against your own system, pass a `respond` function or set an `apiEndpoint`. Branding and conversation logic are entirely independent.

See [Widget integration guide](docs/WIDGET.md). This repository ships no artwork, data, logos or integrations from any private business.
