import { randomUUID } from 'node:crypto';
import { extractKnowledgeFile } from '../dist/index.js';

async function main() {
  const parts = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    total += chunk.length;
    if (total > 64 * 1024 * 1024) throw Error('El archivo supera el límite de 64 MiB.');
    parts.push(chunk);
  }
  const bytes = Buffer.concat(parts);
  const document = await extractKnowledgeFile({
    name: process.argv[2] || '',
    bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    id: randomUUID(),
  }, { maxBytes: 64 * 1024 * 1024, maxPages: 1000, maxTextChars: 1_000_000 });
  process.stdout.write(JSON.stringify({ ok: true, document }));
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : 'No se pudo procesar el archivo.';
  process.stdout.write(JSON.stringify({ ok: false, error: message.slice(0, 200) }));
  process.exitCode = 1;
});