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

/** PDFs with equations may contain hundreds of isolated digits after text extraction.
 * Exclude those runs from user-visible passages and model context, not from the original document. */
export function cleanKnowledgePassage(raw: string): string {
  return raw
    .replace(/\b(?:[0-9]\s+){14,}[0-9]\b/g, ' ')
    .replace(/\b[0-9]{60,}\b/g, ' ')
    .replace(/([A-Za-z0-9])\1{65,}/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function readablePassage(text: string): boolean {
  const words = text.match(/\p{L}{2,}/gu) ?? [];
  const numbers = text.match(/[0-9]/g)?.length ?? 0;
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  // Keep short factual answers (hours, amounts, identifiers), discard mostly-numeric PDF debris.
  return words.length >= 2 && letters >= 10 && numbers <= Math.max(25, letters * 1.5);
}

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
        const passage = cleanKnowledgePassage(passages[i]!);
        if (!readablePassage(passage)) continue;
        const normalized = normalizeText(passage);
        const words = new Set(terms(passage));
        const matched = q.filter((w) => words.has(w)).length;
        // Multiword queries need evidence for at least half of their content words.
        if (matched < Math.max(1, Math.ceil(q.length * 0.5))) continue;
        const coverage = matched / q.length;
        const phrase = needle.length > 5 && normalized.includes(needle) ? 0.4 : 0;
        const density = matched / Math.max(10, words.size);
        const alphabetic = (passage.match(/\p{L}/gu) ?? []).length / Math.max(1, passage.length);
        results.push({ documentId: document.id, title: document.title, passage, section: i + 1,
          score: Number((coverage * 3 + phrase + density + alphabetic * 0.35).toFixed(4)) });
      }
    }
    const seen = new Set<string>();
    return results.sort((a,b) => b.score - a.score || a.title.localeCompare(b.title))
      .filter((hit) => {
        const fingerprint = normalizeText(hit.passage.slice(0, 400));
        if (seen.has(fingerprint)) return false;
        seen.add(fingerprint);
        return true;
      }).slice(0, limit);
  }
}

const SOCIAL = /^(hola|hola cromi|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|hello|hi|gracias|muchas gracias|chau|adios)$/;
/** Social replies never call the model or use document search. */
export function knowledgeSocialReply(base: KnowledgeBase, input: string): string | null {
  const normalized = normalizeText(input);
  if (!SOCIAL.test(normalized)) return null;
  if (/^(gracias|muchas gracias)$/.test(normalized)) return '¡De nada! Si necesitás otra información del documento, preguntame.';
  if (/^(chau|adios)$/.test(normalized)) return '¡Hasta luego!';
  if (!base.size) return '¡Hola! Cargá un documento para que pueda responder preguntas sobre su contenido.';
  return `¡Hola! Tengo ${base.size === 1 ? 'un documento cargado' : base.size + ' documentos cargados'}. ¿Qué te gustaría consultar?`;
}

/** One broad topic repeated in multiple sections is not a complete question. */
export function isBroadKnowledgeQuestion(question: string, sources: readonly KnowledgeHit[]): boolean {
  const normalized = normalizeText(question);
  const looksLikeTopic = normalized.split(' ').length <= 2 || /^(sobre|informacion sobre) /.test(normalized);
  return looksLikeTopic && terms(question).length === 1 && sources.length >= 2;
}

function quoteExcerpt(passage: string, query: string, maxChars = 310): string {
  const words = terms(query);
  const lower = passage.toLowerCase();
  const indexes = words.map((w) => lower.indexOf(w)).filter((i) => i >= 0);
  const anchor = indexes.length ? Math.min(...indexes) : 0;
  let start = Math.max(0, anchor - 70);
  if (start) {
    const nextSpace = passage.indexOf(' ', start);
    if (nextSpace > -1 && nextSpace < start + 30) start = nextSpace + 1;
  }
  let fragment = passage.slice(start, start + maxChars);
  if (start + maxChars < passage.length) {
    const boundary = Math.max(fragment.lastIndexOf('. '), fragment.lastIndexOf('; '));
    if (boundary > maxChars * 0.6) fragment = fragment.slice(0, boundary + 1);
    else { const space = fragment.lastIndexOf(' '); if (space > maxChars * 0.75) fragment = fragment.slice(0, space); }
  }
  return (start ? '…' : '') + fragment.trim() + (start + fragment.length < passage.length ? '…' : '');
}

export function answerWithSources(base: KnowledgeBase, question: string, maxSources = 2): { text: string; sources: KnowledgeHit[] } {
  const matches = base.search(question, Math.max(3, Math.min(20, maxSources)));
  if (!matches.length) return { text: 'No encontré información suficiente en los documentos cargados para responder esa pregunta.', sources: [] };
  if (isBroadKnowledgeQuestion(question, matches)) {
    const title = matches[0]!.title;
    return {
      text: `Encontré varias referencias a «${question.trim().slice(0, 75)}» en «${title}». ¿Qué te gustaría saber en particular? Podés preguntarme por un concepto o tema concreto del documento.`,
      sources: matches.slice(0, 1),
    };
  }
  const sources = matches.slice(0, Math.max(1, Math.min(3, maxSources)));
  const excerpts = sources.map((s) => `${quoteExcerpt(s.passage, question)}\nFuente: ${s.title}, sección ${s.section}`);
  return { text: 'Encontré este fragmento en el documento:\n\n' + excerpts.join('\n\n') + '\n\nEs texto recuperado de la fuente, no una explicación generada por IA.', sources };
}

export function createKnowledgePlugin(base: KnowledgeBase): IntentPlugin {
  return {
    id: 'knowledge', priority: -1,
    score(input, normalized) {
      if (knowledgeSocialReply(base, input)) return 95;
      return base.size && normalized.length > 2 ? 30 : 0;
    },
    respond({ input, session }) {
      const social = knowledgeSocialReply(base, input);
      if (social) return { intent: 'knowledge', text: social };
      const result = answerWithSources(base, input);
      if (result.sources.length) session.data.lastKnowledgeSource = result.sources[0]!.documentId;
      return { intent: 'knowledge', text: result.text };
    },
  };
}