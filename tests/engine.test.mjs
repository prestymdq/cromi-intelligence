import test from "node:test";
import assert from "node:assert/strict";
import { createCromi, createLookupPlugin, createArrayAdapter, normalizeText, MemorySessionStore } from "../dist/index.js";

const records = [
  { id: "a", code: "ABC 01", label: "Servidor Principal", fields: { estado: "operativo", valor: 300 } },
  { id: "b", code: "ABC 02", label: "Servidor Respaldo", fields: { estado: "pendiente" } },
];
const config = { adapter: createArrayAdapter(records), plugins: [createLookupPlugin({ noun: "activos" })] };

test("interpreta la búsqueda en español", async () => {
  const response = await createCromi(config).respond("buscar servidor", "one");
  assert.equal(response.records?.length, 2);
  assert.equal(response.intent, "lookup");
});

test("busca códigos sin asumir una industria", async () => {
  const response = await createCromi(config).respond("buscar ABC 01", "one");
  assert.equal(response.records?.[0]?.id, "a");
});

test("mantiene contexto entre mensajes", async () => {
  const engine = createCromi(config);
  await engine.respond("buscar ABC 01", "one");
  const followUp = await engine.respond("y el estado", "one");
  assert.match(followUp.text, /operativo/);
});

test("aísla sesiones de distintos usuarios", async () => {
  const engine = createCromi(config);
  await engine.respond("buscar ABC 01", "a");
  assert.equal((await engine.getSession("b")), null);
  assert.equal((await engine.getSession("a"))?.turn, 1);
});

test("permite un plugin nuevo sin tocar el motor", async () => {
  const engine = createCromi({ plugins: [{ id: "agenda", score: (_q, norm) => norm.includes("reuniones") ? 80 : 0, respond: () => ({ intent: "agenda", text: "Dos reuniones pendientes" }) }] });
  assert.equal((await engine.respond("¿Cuántas reuniones tengo?", "a")).intent, "agenda");
});

test("nunca ejecuta la acción sugerida automáticamente", async () => {
  const engine = createCromi({ plugins: [{ id: "task", score: () => 10, respond: () => ({ intent: "task", text: "Puedo crear el ticket", proposedAction: { name: "create-ticket", payload: { title: "Error" } } }) }] });
  const response = await engine.respond("crear ticket", "a");
  assert.equal(response.needsConfirmation, true);
  assert.equal(response.proposedAction?.name, "create-ticket");
});

test("evita plugins con IDs duplicados", () => {
  const p = { id: "dup", score: () => 1, respond: () => ({ intent: "dup", text: "ok" }) };
  assert.throws(() => createCromi({ plugins: [p, p] }), /unique/);
});

test("permite conectar memoria externa", async () => {
  const store = new MemorySessionStore();
  const a = createCromi({ ...config, store });
  await a.respond("buscar ABC 02", "one");
  const b = createCromi({ ...config, store });
  assert.equal((await b.getSession("one"))?.lastRecordIds[0], "b");
});

test("normaliza acentos", () => assert.equal(normalizeText("Revisión TÉCNICA"), "revision tecnica"));

test("aplica límites de seguridad a mensajes", async () => {
  const engine = createCromi(config);
  await assert.rejects(engine.respond("x".repeat(10001), "one"), /10000/);
});

test("no inventa datos cuando el adaptador no coincide", async () => {
  const reply = await createCromi(config).respond("buscar Unicornio", "one");
  assert.equal(reply.records, undefined);
  assert.match(reply.text, /No encontré/);
});
