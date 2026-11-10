import test from "node:test";
import assert from "node:assert/strict";
import { createCromi, createLookupPlugin, createArrayAdapter, resolveBatch, createBatchPlugin } from "../dist/index.js";

const adapter = createArrayAdapter([
  { id: "a", code: "ABC 01", label: "Servidor Principal" },
  { id: "b", code: "ABC 02", label: "Servidor Respaldo" },
]);

test("resuelve listas grandes sin truncar y separa repetidos", async () => {
  const input = Array.from({ length: 277 }, (_, i) => i === 0 ? "ABC 01" : "ABC 02").join("\n");
  const result = await resolveBatch(input, adapter);
  assert.equal(result.length, 277);
  assert.equal(result.filter((r) => r.status === "matched").length, 2);
  assert.equal(result.filter((r) => r.status === "duplicate").length, 275);
});

test("distingue coincidencias ambiguas", async () => {
  const source = createArrayAdapter([{ id: "x", label: "Manual" }, { id: "y", label: "Manual" }]);
  const result = await resolveBatch("Manual", source);
  assert.equal(result[0].status, "ambiguous");
});

test("integra el análisis de listas como plugin opcional", async () => {
  const engine = createCromi({ adapter, plugins: [createLookupPlugin(), createBatchPlugin()] });
  const reply = await engine.respond("ABC 01\nABC 02\nABC 02", "batch-user");
  assert.equal(reply.intent, "batch");
  assert.match(reply.text, /1 repetidas/);
  assert.equal((await engine.getSession("batch-user")).data.lastBatchTotal, 3);
});
