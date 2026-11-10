import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createCromi, KnowledgeBase, createKnowledgePlugin, createOllamaKnowledgePlugin, extractKnowledgeFile } from '../dist/index.js';

/** Local-only demo: no file persistence, no external API, no user accounts. */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4174);
const host = '127.0.0.1';
const base = new KnowledgeBase({ maxDocuments: 20, maxDocumentChars: 250_000 });
const useOllama = process.env.CROMI_USE_OLLAMA === '1';
const engine = createCromi({ plugins: [useOllama
  ? createOllamaKnowledgePlugin(base, { model: process.env.CROMI_OLLAMA_MODEL || 'llama3.2:3b' })
  : createKnowledgePlugin(base)], fallbackText: 'Cargá un documento para comenzar.' });

const maxBodyBytes = 5 * 1024 * 1024;
const writeJson = (res, code, payload) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(payload));
};
async function readBody(req, limit) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) throw Object.assign(new Error('El archivo es demasiado grande.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function allowedPath(pathname) {
  const file = pathname === '/' ? '/examples/knowledge.html' : pathname;
  if (!(file === '/examples/knowledge.html' || file.startsWith('/widget/') || file.startsWith('/dist/'))) return null;
  if (file.includes('\\') || file.includes('\0')) return null;
  const absolute = resolve(root, '.' + file);
  const rel = relative(root, absolute);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) return null;
  if (!['.html', '.css', '.js'].includes(extname(absolute))) return null;
  return absolute;
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  return !origin || origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://${host}:${port}`).pathname;
    if (pathname.startsWith('/api/knowledge/')) {
      if (!sameOrigin(req)) return writeJson(res, 403, { error: 'Origen no permitido.' });
      if (pathname === '/api/knowledge/documents' && req.method === 'GET') {
        return writeJson(res, 200, { documents: base.list(), mode: useOllama ? 'ollama-local' : 'extractive' });
      }
      if (pathname === '/api/knowledge/documents' && req.method === 'DELETE') {
        base.clear();
        return writeJson(res, 200, { documents: [] });
      }
      if (pathname === '/api/knowledge/upload' && req.method === 'POST') {
        if (req.headers['content-type'] !== 'application/octet-stream') return writeJson(res, 415, { error: 'Formato de solicitud no permitido.' });
        const rawName = String(req.headers['x-cromi-filename'] || '');
        let name;
        try { name = decodeURIComponent(rawName); }
        catch { return writeJson(res, 400, { error: 'Nombre del archivo inválido.' }); }
        const file = await readBody(req, maxBodyBytes);
        const doc = await extractKnowledgeFile({ name, bytes: new Uint8Array(file), id: randomUUID() });
        base.add(doc);
        return writeJson(res, 201, { document: { id: doc.id, title: doc.title, characters: doc.text.length }, documents: base.list() });
      }
      if (pathname === '/api/knowledge/chat' && req.method === 'POST') {
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) return writeJson(res, 415, { error: 'Se requiere JSON.' });
        const bytes = await readBody(req, 8 * 1024);
        let body;
        try { body = JSON.parse(bytes.toString('utf8')); }
        catch { return writeJson(res, 400, { error: 'JSON inválido.' }); }
        if (typeof body.message !== 'string' || body.message.length > 2000 || !body.message.trim()
          || typeof body.sessionId !== 'string' || body.sessionId.length > 100 || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.sessionId)) {
          return writeJson(res, 400, { error: 'Consulta inválida.' });
        }
        const reply = await engine.respond(body.message, body.sessionId);
        return writeJson(res, 200, { text: reply.text });
      }
      return writeJson(res, 404, { error: 'Ruta no disponible.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return writeJson(res, 405, { error: 'Método no permitido.' });
    const fullPath = allowedPath(pathname);
    if (!fullPath) return writeJson(res, 404, { error: 'No encontrado.' });
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
    try {
      const body = await readFile(fullPath);
      res.writeHead(200, { 'Content-Type': mime[extname(fullPath)], 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { writeJson(res, 404, { error: 'Archivo no encontrado.' }); }
  } catch (error) {
    const code = error.status === 413 ? 413 : error.message?.includes('limite') || error.message?.includes('límite') ? 422 : 400;
    const message = code === 400 && !(error instanceof SyntaxError) ? String(error.message || 'Solicitud inválida.') : 'Solicitud inválida.';
    writeJson(res, code, { error: message.slice(0, 240) });
  }
});
server.requestTimeout = 20_000;
server.listen(port, host, () => console.log(`Cromi Knowledge local: http://${host}:${port} (${useOllama ? 'Ollama local' : 'sin IA'})`));