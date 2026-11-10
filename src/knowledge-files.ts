import type { KnowledgeDocument } from './knowledge.js';

export type SupportedKnowledgeFile = '.txt' | '.md' | '.pdf' | '.docx';
export interface DocumentInput { name: string; bytes: Uint8Array; id?: string }
export interface KnowledgeImportOptions { maxBytes?: number; maxPages?: number; maxTextChars?: number }

/** Server-side extraction only: never fetch external URLs or persist uploaded bytes. */
export async function extractKnowledgeFile(input: DocumentInput, options: KnowledgeImportOptions = {}): Promise<KnowledgeDocument> {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const maxPages = options.maxPages ?? 100;
  const maxTextChars = options.maxTextChars ?? 250_000;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 20*1024*1024) throw Error('maxBytes inválido');
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 200) throw Error('maxPages inválido');
  if (!Number.isSafeInteger(maxTextChars) || maxTextChars < 1 || maxTextChars > 2_000_000) throw Error('maxTextChars inválido');
  if (!(input.bytes instanceof Uint8Array) || !input.bytes.length || input.bytes.length > maxBytes) throw Error('Tamaño de archivo no permitido');
  const name = input.name.trim().split(/[\\/]/).pop()?.slice(0, 120) || '';
  const ext = /\.(txt|md|pdf|docx)$/i.exec(name)?.[0].toLowerCase() as SupportedKnowledgeFile | undefined;
  if (!ext) throw Error('Formato no permitido: usá TXT, MD, PDF o DOCX');
  let text = '';
  if (ext === '.txt' || ext === '.md') {
    text = new TextDecoder('utf-8', { fatal: true }).decode(input.bytes);
  } else if (ext === '.pdf') {
    // Dynamic imports keep the core dependency-free and avoid loading PDF.js in browsers.
    const packageName = 'pdfjs-dist/legacy/build/pdf.mjs';
    const pdfjs = await import(packageName);
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(input.bytes), useSystemFonts: true });
    try {
      const pdf = await loadingTask.promise;
      if (pdf.numPages > maxPages) throw Error('El PDF supera el límite de páginas');
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: { str?: string }) => item.str || '').filter(Boolean).join(' ');
        pages.push('Página ' + i + '\n' + pageText);
        page.cleanup();
        if (pages.join('').length > maxTextChars) throw Error('El PDF supera el límite de texto');
      }
      text = pages.join('\n\n');
    } finally { await loadingTask.destroy(); }
  } else {
    const packageName = 'mammoth';
    const mammoth = await import(packageName);
    const BufferClass = (globalThis as unknown as { Buffer: { from(data: Uint8Array): unknown } }).Buffer;
    if (!BufferClass) throw Error('DOCX requiere un entorno Node.js');
    const result = await mammoth.extractRawText({ buffer: BufferClass.from(input.bytes) });
    text = result.value;
  }
  if (!text.trim()) throw Error('El documento no contiene texto seleccionable. No incluye OCR para escaneos.');
  if (text.length > maxTextChars) throw Error('El documento supera el límite de texto');
  return { id: input.id || name, title: name, text };
}