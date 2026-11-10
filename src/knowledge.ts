import { normalizeText } from './normalize.js';
import type { IntentPlugin } from './types.js';

/** Documents live only in the in-memory index unless a host supplies persistence. */
export interface KnowledgeDocument { id: string; title: string; text: string }
export interface KnowledgeHit {
  documentId: string;
  title: string;
  passage: string;
  section: number;
  score: number;
}
export interface KnowledgeOptions { maxDocuments?: number; maxDocumentChars?: number; chunkChars?: number }
const STOP = new Set('a al ante como con contra cual cuales cuando cuanto de del donde el ella en es esta este esto hay la las lo los me mi mis no o para por porque que se ser si son su sus un una uno unas unos y sobre quiero saber informacion'.split(' '));
const terms = (s: string) => [...new Set(normalizeText(s).split(/\s+/).filter((w) => w.length >= 2 && !STOP.has(w)))];

function chunkText(raw: string, size: number): string[] {
  const text = raw.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const paragraphs = text.split(/\n\s*\n/).map((s) => s.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  const flush = () => { if (current) { chunks.push(current); current = ''; } };
  for (const paragraph of paragraphs) {
    const pieces = paragraph.match(new RegExp('[\\s\\S]{1,' + size + '}', 'g')) ?? [];
    for (const piece of pieces) {
      if (current && current.length + piece.length + 2 > size) flush();
      current += (current ? '\n' : '') + piece;
    }
    if (current.length > size * 0.7) flush();
  }
  flush();
  return chunks;
}

export class KnowledgeBase {
  private docs = new Map<string, { document: KnowledgeDocument; passages: string[] }>();
  private maxDocuments: number;
  private maxDocumentChars: number;
  private chunkChars: number;
  constructor(options: KnowledgeOptions = {}) {
    this.maxDocuments = options.maxDocuments ?? 20;
    this.maxDocumentChars = options.maxDocumentChars ?? 250_000;
    this.chunkChars = options.chunkChars ?? 700;
    if (!Number.isSafeInteger(this.maxDocuments) || this.maxDocuments < 1 || this.maxDocuments > 1000) throw Error('maxDocuments debe estar entre 1 y 1000');
    if (!Number.isSafeInteger(this.maxDocumentChars) || this.maxDocumentChars < 1 || this.maxDocumentChars > 2_000_000) throw Error('maxDocumentChars inválido');
    if (!Number.isSafeInteger(this.chunkChars) || this.chunkChars < 100 || this.chunkChars > 4000) throw Error('chunkChars debe estar entre 100 y 4000');
  }
  add(document: KnowledgeDocument) {
    if (!document.id || !document.id.trim() || !document.title || !document.title.trim()) throw Error('Documento sin identificación o título');
    if (!document.text?.trim()) throw Error('El documento está vacío o no contiene texto extraíble');
    if (document.text.length > this.maxDocumentChars) throw Error('El documento excede el límite de texto');
    if (!this.docs.has(document.id) && this.docs.size >= this.maxDocuments) throw Error('Se alcanzó el límite de documentos');
    const passages = chunkText(document.text, this.chunkChars);
    this.docs.set(document.id, { document: { ...document }, passages });
    return passages.length;
  }
  remove(id: string) { return this.docs.delete(id); }
  clear() { this.docs.clear(); }
  list() { return [...this.docs.values()].map(({ document, passages }) => ({ id: document.id, title: document.title, sections: passages.length })); }
  get size() { return this.docs.size; }
  search(query: string, limit = 3): KnowledgeHit[] {
    const q = terms(query);
    if (!q.length) return [];
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw Error('Límite inválido');
    const results: KnowledgeHit[] = [];
    const needle = normalizeText(query);
    for (const { document, passages } of this.docs.values()) {
      for (let i = 0; i < passages.length; i++) {
        const passage = passages[i]!;
        const normalized = normalizeText(passage);
        const words = new Set(terms(passage));
        const matched = q.filter((w) => words.has(w)).length;
        // Multiword queries need evidence for at least half of their content words.
        if (matched < Math.max(1, Math.ceil(q.length * 0.5))) continue;
        const coverage = matched / q.length;
        const phrase = needle.length > 5 && normalized.includes(needle) ? 0.4 : 0;
        const density = matched / Math.max(10, words.size);
        results.push({ documentId: document.id, title: document.title, passage, section: i + 1,
          score: Number((coverage * 3 + phrase + density).toFixed(4)) });
      }
    }
    return results.sort((a,b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0,limit);
  }
}

export function answerWithSources(base: KnowledgeBase, question: string, maxSources = 3): { text: string; sources: KnowledgeHit[] } {
  const sources = base.search(question, maxSources);
  if (!sources.length) return { text: 'No encontré información suficiente en los documentos cargados para responder esa pregunta.', sources: [] };
  const excerpts = sources.map((s, i) => `[${i+1}] ${s.passage.slice(0, 650)}\nFuente: ${s.title}, sección ${s.section}`);
  return { text: 'Esto es lo que encontré en la documentación:\n\n' + excerpts.join('\n\n') + '\n\nEstos son extractos del documento, no una conclusión generada por IA.', sources };
}

export function createKnowledgePlugin(base: KnowledgeBase): IntentPlugin {
  return {
    id: 'knowledge', priority: -1,
    score(input, normalized) { return base.size && normalized.length > 2 && !/^(hola|buenas|gracias|chau|adios)$/.test(normalized) ? 30 : 0; },
    respond({ input, session }) {
      const result = answerWithSources(base, input);
      if (result.sources.length) session.data.lastKnowledgeSource = result.sources[0]!.documentId;
      return { intent: 'knowledge', text: result.text };
    },
  };
}