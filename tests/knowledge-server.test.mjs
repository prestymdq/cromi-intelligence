import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function startServer() {
  const port = 41000 + Math.floor(Math.random()*12000);
  const server = spawn(process.execPath, ['examples/serve-knowledge.mjs'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), CROMI_USE_OLLAMA: '0' }, stdio: ['ignore','pipe','pipe'] });
  let output = '';
  server.stdout.on('data', (chunk) => { output += chunk.toString(); });
  server.stderr.on('data', (chunk) => { output += chunk.toString(); });
  for (let attempt=0; attempt<60; attempt++) {
    if (server.exitCode !== null) throw Error('Server terminated: '+output);
    try { const res=await fetch(`http://127.0.0.1:${port}/api/knowledge/documents`); if(res.ok) return {server, base:`http://127.0.0.1:${port}`}; } catch { }
    await new Promise((r)=>setTimeout(r,60));
  }
  server.kill();throw Error('Server failed to start: '+output);
}

test('local upload, grounded answer, blocked cross-origin, clearing and no private static files', async (t) => {
  const {server,base}=await startServer();
  t.after(async () => { server.kill(); await Promise.race([once(server,'close'),new Promise(r=>setTimeout(r,1000))]); });
  let response=await fetch(base+'/'); assert.equal(response.status,200);assert.match(await response.text(),/Cromi Knowledge/);
  response=await fetch(base+'/api/knowledge/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Cromi-Filename':'help.txt'},body:'Horarios de soporte: lunes a viernes, de 9 a 18.'});
  assert.equal(response.status,201);assert.equal((await response.json()).documents.length,1);
  response=await fetch(base+'/api/knowledge/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'¿Cuáles son los horarios de soporte?',sessionId:'client-a'})});
  assert.equal(response.status,200);const answer=(await response.json()).text;assert.match(answer,/lunes a viernes/);assert.match(answer,/Fuente: help.txt/);
  response=await fetch(base+'/api/knowledge/chat',{method:'POST',headers:{Origin:'https://external.invalid','Content-Type':'application/json'},body:JSON.stringify({message:'horarios',sessionId:'client-a'})});assert.equal(response.status,403);
  response=await fetch(base+'/README.md');assert.equal(response.status,404);
  response=await fetch(base+'/api/knowledge/documents',{method:'DELETE'});assert.equal(response.status,200);
  response=await fetch(base+'/api/knowledge/documents');assert.deepEqual((await response.json()).documents,[]);
});

test('un PDF dañado responde con error sin cortar la conexión del servidor', async (t) => {
  const {server,base} = await startServer();
  t.after(async () => {
    if (server.exitCode === null) server.kill();
    await Promise.race([once(server,'close'),new Promise(r=>setTimeout(r,1000))]);
  });
  const bad = await fetch(base + '/api/knowledge/upload', {
    method:'POST',
    headers: {'Content-Type':'application/octet-stream','X-Cromi-Filename':'invalid.pdf'},
    body: Buffer.from('%PDF-1.7\nThis is intentionally not a PDF\n%%EOF'),
  });
  assert.ok([400, 422, 503].includes(bad.status), 'Expected a handled parser error: ' + bad.status);
  const payload = await bad.json();
  assert.equal(typeof payload.error, 'string');
  const alive = await fetch(base + '/api/knowledge/documents');
  assert.equal(alive.status, 200);
  const good = await fetch(base + '/api/knowledge/upload', {
    method:'POST',
    headers: {'Content-Type':'application/octet-stream','X-Cromi-Filename':'manual.txt'},
    body: 'Atención al público: lunes a viernes.',
  });
  assert.equal(good.status, 201);
});
