import test from 'node:test';
import assert from 'node:assert/strict';
import { createCromi, KnowledgeBase, createKnowledgePlugin, answerWithSources, extractKnowledgeFile, createOllamaKnowledgePlugin } from '../dist/index.js';

const makeBase=()=>{const kb=new KnowledgeBase();kb.add({id:'manual-1',title:'Manual de Servicios',text:'Horarios de atención: lunes a viernes, de 8:00 a 18:00.\n\nInscripciones: se realizan por formulario web; no hay pagos anticipados.\n\nContactos: escribí al correo de soporte del proveedor.'});return kb;};

test('fuentes explícitas y respuestas sin LLM',()=>{
  const kb=makeBase();const answer=answerWithSources(kb,'¿Cuáles son los horarios de atención?');
  assert.match(answer.text,/lunes a viernes/);assert.match(answer.text,/Fuente: Manual de Servicios/);assert.ok(answer.sources.length);assert.equal(answer.sources[0].documentId,'manual-1');
});
test('preguntas fuera del documento no inventan',()=>{
  const answer=answerWithSources(makeBase(),'¿Qué precio tiene un curso de medicina?');assert.deepEqual(answer.sources,[]);assert.match(answer.text,/No encontré información suficiente/);
});
test('integración con el motor y memoria',async()=>{
  const engine=createCromi({plugins:[createKnowledgePlugin(makeBase())]});const r=await engine.respond('¿Horarios de atención?','usuario-test');assert.equal(r.intent,'knowledge');const session=await engine.getSession('usuario-test');assert.equal(session.data.lastKnowledgeSource,'manual-1');
});
test('limpieza y borrado sin persistencia',()=>{const kb=makeBase();assert.equal(kb.size,1);assert.equal(kb.remove('manual-1'),true);assert.deepEqual(kb.search('horarios'),[]);kb.add({id:'2',title:'Nuevo',text:'Cita con turno asignado'});kb.clear();assert.equal(kb.size,0)});
test('índice por párrafos, sin truncar ni mezclar documentos',()=>{const kb=new KnowledgeBase({chunkChars:140});kb.add({id:'a',title:'Política A',text:'A'.repeat(380)+'\n\nEl cierre anual del edificio se realiza en febrero.'});kb.add({id:'b',title:'Política B',text:'El inventario se actualiza cada miércoles.'});assert.ok(kb.list().find(x=>x.id==='a').sections>=3);assert.equal(kb.search('inventario miércoles')[0]?.documentId,'b');});
test('controles de límite de documentos',()=>{const kb=new KnowledgeBase({maxDocuments:1,maxDocumentChars:20});kb.add({id:'a',title:'Uno',text:'Texto'});assert.throws(()=>kb.add({id:'b',title:'Dos',text:'Texto'}),/límite/);assert.throws(()=>kb.add({id:'a',title:'Uno',text:'x'.repeat(21)}),/límite/);});
test('archivos TXT/MD extraídos localmente',async()=>{for(const name of ['manual.txt','ayuda.md']){const d=await extractKnowledgeFile({name,bytes:new TextEncoder().encode('Condiciones y horarios de atención')});assert.match(d.text,/Condiciones/);assert.equal(d.title,name);}});
test('rechaza archivos no permitidos, binarios e inválidos',async()=>{for(const name of ['keys.env','script.js','secret.pdf.exe'])await assert.rejects(extractKnowledgeFile({name,bytes:new Uint8Array([65])}),/Formato no permitido/);await assert.rejects(extractKnowledgeFile({name:'invalid.txt',bytes:new Uint8Array([0xff,0xff])}));await assert.rejects(extractKnowledgeFile({name:'big.txt',bytes:new Uint8Array(50),},{maxBytes:10}),/Tamaño de archivo/);});
test('Ollama solo permite loopback y rechaza URLs con secretos',()=>{for(const url of ['https://example.org','http://203.0.113.1:11434/','http://user:secret@localhost:11434/','file:///etc/passwd'])assert.throws(()=>createOllamaKnowledgePlugin(makeBase(),{baseUrl:url}),/Ollama solo admite/);});
test('Ollama recibe solo fragmentos y fuentes; no se conecta a APIs externas',async()=>{const requests=[];const fetcher=async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return{ok:true,json:async()=>({message:{content:'Los horarios son de lunes a viernes [1].'}})}};const engine=createCromi({plugins:[createOllamaKnowledgePlugin(makeBase(),{fetcher})]});const reply=await engine.respond('horarios de atención','usuario');assert.match(reply.text,/lunes a viernes/);assert.match(reply.text,/Fuentes consultadas/);assert.equal(requests.length,1);assert.equal(requests[0].url,'http://127.0.0.1:11434/api/chat');assert.equal(requests[0].body.stream,false);assert.equal(requests[0].body.model,'llama3.2:3b');});
test('Ollama falla cerrado a extractos locales sin exponer errores internos',async()=>{const failed=async()=>{throw Error('INTERNAL_SECRETS')};const engine=createCromi({plugins:[createOllamaKnowledgePlugin(makeBase(),{fetcher:failed})]});const reply=await engine.respond('horarios de atención','usuario');assert.match(reply.text,/Ollama local no está disponible/);assert.ok(!reply.text.includes('INTERNAL_SECRETS'));});
test('Ollama no envía nada si el documento no contiene la respuesta',async()=>{let count=0;const engine=createCromi({plugins:[createOllamaKnowledgePlugin(makeBase(),{fetcher:async()=>{count++}})]});const reply=await engine.respond('¿Cuáles son los planetas de Saturno?','u');assert.equal(count,0);assert.match(reply.text,/No encontré información/);});

test('saluda sin confundir un saludo con búsqueda documental', async () => {
  const engine = createCromi({ plugins: [createKnowledgePlugin(makeBase())], fallbackText: 'Cargá un documento para comenzar.' });
  const reply = await engine.respond('hola', 'qa');
  assert.match(reply.text, /¡Hola!/);
  assert.match(reply.text, /documento cargado/);
  assert.doesNotMatch(reply.text, /Cargá un documento/);
});

test('saluda cuando todavía no hay documentos y responde agradecimientos', async () => {
  const engine = createCromi({ plugins: [createKnowledgePlugin(new KnowledgeBase())] });
  assert.match((await engine.respond('hola', 'qa')).text, /Cargá un documento/);
  assert.match((await engine.respond('gracias', 'qa')).text, /De nada/);
});

test('descarta ruido numérico extraído de PDF sin arruinar el texto válido', () => {
  const base = new KnowledgeBase();
  base.add({id: 'a', title: 'Matemática', text: 'La matemática estudia relaciones entre números. 7 7 3 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7'});
  const result = answerWithSources(base, '¿Qué estudia la matemática?');
  assert.match(result.text, /estudia relaciones entre números/);
  assert.doesNotMatch(result.text, /7 7 7 7 7/);
  assert.match(result.text, /Fuente: Matemática/);
});

test('consulta de un tema general pide precisión cuando aparecen varias secciones', () => {
  const base = new KnowledgeBase({chunkChars:100});
  base.add({id: 'a', title: 'Manual público', text: 'La matemática se utiliza para resolver problemas de geometría y números.\n\nEn la matemática también existen operaciones de álgebra y fracciones.'});
  const response = answerWithSources(base, 'matemática');
  assert.match(response.text, /¿Qué te gustaría saber en particular/);
  assert.ok(response.text.length < 350);
});

test('respuestas específicas son breves, citadas y sin párrafos duplicados', () => {
  const base = new KnowledgeBase();
  base.add({id: 'a', title: 'Manual', text: Array(4).fill('Las inscripciones se reciben de lunes a viernes mediante el formulario en línea de la institución.').join('\n\n')});
  const reply = answerWithSources(base, '¿Cómo se reciben las inscripciones?');
  assert.equal(reply.sources.length, 1);
  assert.match(reply.text, /formulario en línea/);
  assert.match(reply.text, /Fuente: Manual/);
  assert.ok(reply.text.length < 600);
});

test('Ollama no recibe saludos ni consultas que necesitan aclaración', async () => {
  const base = new KnowledgeBase({chunkChars:100});
  base.add({id:'a',title:'Matemática',text:'La matemática abarca el álgebra y la geometría.\n\nEn matemática también se estudian conjuntos y funciones.'});
  let calls = 0;
  const engine = createCromi({plugins:[createOllamaKnowledgePlugin(base,{fetcher:async()=>{calls++;throw Error('should not call')}})]});
  assert.match((await engine.respond('hola','s')).text,/¡Hola!/);
  assert.match((await engine.respond('matemática','s')).text,/¿Qué te gustaría saber/);
  assert.equal(calls,0);
});

test('una pregunta concreta con un solo término clave no es tratada como tema ambiguo', () => {
  const base = new KnowledgeBase({chunkChars:100});
  base.add({id:'a',title:'Teoría',text:'La matemática estudia las relaciones entre objetos abstractos y operaciones.\n\nLa matemática utiliza demostraciones y razonamiento formal.'});
  const reply = answerWithSources(base, '¿Qué es la matemática?');
  assert.match(reply.text, /Fuente: Teoría/);
  assert.doesNotMatch(reply.text, /¿Qué te gustaría saber/);
});
