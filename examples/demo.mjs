import { createCromi, createArrayAdapter, createLookupPlugin } from "../dist/index.js";

const helpdesk = createCromi({
  adapter: createArrayAdapter([
    { id: "t-1", code: "INC 100", label: "Problema de acceso", fields: { estado: "en revisión", prioridad: "alta" } },
    { id: "t-2", code: "INC 101", label: "Error de sincronización", fields: { estado: "resuelto", prioridad: "media" } },
  ]),
  plugins: [createLookupPlugin({ noun: "tickets" })],
});

const inventory = createCromi({
  adapter: createArrayAdapter([
    { id: "d-1", code: "EQ 01", label: "Notebook", fields: { disponibles: 3, ubicacion: "Depósito A" } },
    { id: "d-2", code: "EQ 02", label: "Proyector", fields: { disponibles: 1, ubicacion: "Depósito B" } },
  ]),
  plugins: [createLookupPlugin({ noun: "equipos" })],
});

for (const [label, engine, messages] of [
  ["Mesa de ayuda", helpdesk, ["buscar INC 100", "y el estado"]],
  ["Inventario", inventory, ["buscar notebook", "y el detalle"]],
]) {
  console.log("\n[" + label + "]");
  for (const message of messages) {
    const response = await engine.respond(message, "example-user");
    console.log("> " + message + "\n" + response.text);
  }
}
