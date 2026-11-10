import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Isolate document parsers from the HTTP server. A malformed PDF or native
 * parser crash must not terminate the assistant or leave clients with a
 * network-level "Failed to fetch" error.
 *
 * In-memory IPC only: never writes the uploaded bytes to disk.
 */
export function extractKnowledgeInChild({ name, bytes }, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const maxStdoutBytes = 2 * 1024 * 1024;
  if (typeof name !== 'string' || !(bytes instanceof Uint8Array)) {
    return Promise.reject(Object.assign(new Error('Archivo inválido.'), { status: 400 }));
  }
  return new Promise((resolve, reject) => {
    let done = false;
    let output = [];
    let outputBytes = 0;
    const workerFile = fileURLToPath(new URL('./parse-knowledge-worker.mjs', import.meta.url));
    // Do not pass secrets or API credentials inherited from the parent server.
    const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE']
      .filter((key) => typeof process.env[key] === 'string')
      .map((key) => [key, process.env[key]]));
    const worker = spawn(process.execPath, [workerFile, name], {
      env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    const timer = setTimeout(() => {
      fail('El documento tardó demasiado en procesarse.');
    }, timeoutMs);
    timer.unref?.();
    function finish() {
      if (done) return false;
      done = true;
      clearTimeout(timer);
      return true;
    }
    function fail(message, status = 422) {
      if (!finish()) return;
      worker.kill();
      reject(Object.assign(new Error(message), { status }));
    }
    worker.on('error', () => fail('No se pudo iniciar el lector de documentos.', 503));
    worker.stdout.on('data', (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > maxStdoutBytes) {
        fail('El documento supera el límite de contenido permitido.');
        return;
      }
      output.push(chunk);
    });
    // Drain diagnostic output without exposing document contents to clients.
    worker.stderr.resume();
    worker.stdin.on('error', () => { /* a crashed child is reported by close */ });
    worker.on('close', (code) => {
      if (done) return;
      let payload;
      try { payload = JSON.parse(Buffer.concat(output).toString('utf8')); }
      catch {
        fail('El lector de documentos se interrumpió. Probá con otro archivo o exportá nuevamente el PDF.');
        return;
      }
      if (!payload?.ok || code !== 0) {
        const reason = typeof payload?.error === 'string' && payload.error.length < 220
          ? payload.error : 'No se pudo extraer el texto del documento.';
        fail(reason);
        return;
      }
      if (typeof payload.document?.text !== 'string' || typeof payload.document?.title !== 'string') {
        fail('El documento no devolvió texto válido.');
        return;
      }
      if (finish()) resolve(payload.document);
    });
    worker.stdin.end(Buffer.from(bytes));
  });
}
