import { randomUUID } from 'node:crypto';
import { extractKnowledgeFile } from '../dist/index.js';

async function main() {
  const parts = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    total += chunk.length;
    if (total > 5 * 1024 * 1024) throw Error('El archivo supera el límite de 5 MiB.');
    parts.push(chunk);
  }
  const document = await extractKnowledgeFile({
    name: process.argv[2] || '',
    bytes: new Uint8Array(Buffer.concat(parts)),
    id: randomUUID(),
  });
  process.stdout.write(JSON.stringify({ ok: true, document }));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'No se pudo procesar el archivo.';
  process.stdout.write(JSON.stringify({ ok: false, error: message.slice(0, 200) }));
  process.exitCode = 1;
});
