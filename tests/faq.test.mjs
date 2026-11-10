import test from "node:test";
import assert from "node:assert/strict";
import { createCromi, createFaqPlugin } from "../dist/index.js";

const knowledge = createFaqPlugin([
  { id: "hours", question: "¿Cuáles son los horarios?", aliases: ["horarios", "a que hora atienden"], answer: "Atendemos de lunes a viernes." },
  { id: "services", question: "¿Qué servicios ofrecen?", aliases: ["servicios", "servicio disponible"], answer: "Ofrecemos asesoramiento y soporte." },
]);

test("responde una pregunta frecuente exacta", async () => {
  const reply = await createCromi({ plugins: [knowledge] }).respond("¿Cuáles son los horarios?", "a");
  assert.equal(reply.text, "Atendemos de lunes a viernes.");
});

test("reconoce formas alternativas sin llamar IA externa", async () => {
  const reply = await createCromi({ plugins: [knowledge] }).respond("A qué hora atienden?", "a");
  assert.equal(reply.intent, "faq");
});

test("no inventa respuesta ante consultas desconocidas", async () => {
  const reply = await createCromi({ plugins: [knowledge], fallbackText: "No tengo esa información." }).respond("¿Quién ganó la carrera?", "a");
  assert.equal(reply.intent, "fallback");
  assert.equal(reply.text, "No tengo esa información.");
});

test("conserva solo el ID FAQ y metadatos de sesión", async () => {
  const engine = createCromi({ plugins: [knowledge] });
  await engine.respond("horarios", "a");
  const session = await engine.getSession("a");
  assert.equal(session.data.lastFaqId, "hours");
  assert.equal(session.turn, 1);
});

test("rechaza entradas duplicadas o incompletas", () => {
  assert.throws(() => createFaqPlugin([{ id: "x", question: "hola", answer: "ok" }, { id: "x", question: "otra", answer: "ok" }]), /unique/);
  assert.throws(() => createFaqPlugin([{ id: "x", question: " ", answer: "ok" }]), /non-empty/);
});
