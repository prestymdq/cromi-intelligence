# Cromi Knowledge — documentos y Ollama local (v0.2)

Cromi Knowledge es un módulo independiente y de código abierto para consultas sobre documentos de cualquier organización. **No se incluyen documentos reales ni datos privados.** No usa servicios de IA externos ni claves de API.

## Ejecutar la demostración

Se requiere Node.js 20.16 o superior (recomendado Node.js 22 LTS) y NPM:

```bash
npm install
npm test
npm run demo:knowledge
```

Abrí **http://127.0.0.1:4174** en la misma computadora. El servidor escucha únicamente en `127.0.0.1` y los archivos se mantienen **en memoria RAM** hasta que se detiene el proceso o se pulsa borrar. No se guardan en Git ni se suben a servicios externos. Podés importar TXT, Markdown, PDF con texto seleccionable o DOCX. No se incluye OCR para PDFs escaneados.

**Límites de la demo:** máximo 64 MiB por archivo, 20 archivos y 1.000.000 caracteres por documento, 1000 páginas PDF como máximo. Para proteger un despliegue público hacen falta autenticación, autorización, aislamiento entre empresas, limitación de solicitudes, auditoría y almacenamiento seguro, implementados por el integrador. **La demo no debe publicarse directamente en Internet.** No uses material confidencial si no controlás el equipo.

## Modo sin IA: gratuito y autónomo

El modo predeterminado indexa el texto localmente y muestra fragmentos relevantes, con título del documento y sección. No es un modelo generativo: las respuestas son extractivas y no resumen libremente material complejo. Si no halla evidencia suficiente lo indica y evita inventar datos.

## Modo Ollama: opcional, sin API paga

1. Instalá [Ollama](https://ollama.com/) en tu propio equipo o servidor.
2. Descargá un modelo permitido por su licencia: `ollama pull llama3.2:3b` (o elegí otro disponible).
3. Iniciá la demo con una variable de entorno:

**PowerShell (Windows):**

```powershell
$env:CROMI_USE_OLLAMA='1'
npm run demo:knowledge
```

**Bash (Linux/macOS):**

```bash
CROMI_USE_OLLAMA=1 npm run demo:knowledge
```

Para otro modelo establecé `CROMI_OLLAMA_MODEL`. El módulo solo admite por diseño Ollama por HTTP en loopback (`127.0.0.1`, `localhost` o `[::1]`) y no recibe tokens ni credenciales. El modelo consulta fragmentos relevantes de los documentos en memoria. Si Ollama está caído, Cromi vuelve a responder con los fragmentos recuperados, sin enviar datos a otro proveedor.

Ollama y algunos modelos pueden utilizarse sin pago de licencia o por consulta, pero necesitás RAM/CPU/GPU y los costos normales de tu equipo o servidor. **Verificá la licencia del modelo** antes de redistribuirlo o usarlo comercialmente.

**Limitaciones:** la IA puede cometer errores o seguir instrucciones maliciosas dentro de un documento pese a las defensas del prompt; el host debe validar respuestas y acceso a datos sensibles. Los títulos y fragmentos citados al pie son las fuentes consultadas; no garantizan que cada afirmación del modelo esté sustentada. No envíes datos confidenciales a una instancia de Ollama compartida.

## APIs internas de la demo

- `GET /api/knowledge/documents` — lista nombres y secciones de los documentos en RAM.
- `POST /api/knowledge/upload` — cuerpo binario (hasta 64 MiB), cabeceras `Content-Type: application/octet-stream` y `X-Cromi-Filename` (nombre codificado con `encodeURIComponent`).
- `POST /api/knowledge/chat` — JSON `{ "message": "pregunta", "sessionId": "uuid" }`, respuesta `{ "text": "respuesta" }`.
- `DELETE /api/knowledge/documents` — limpia la documentación en memoria.

Las rutas son **para desarrollo local**, sin sistema de usuarios ni separación por organizaciones. El servidor limita origen, extensiones, tamaños, operaciones y accesos a archivos, pero no reemplaza una arquitectura segura de producción.

## Integración con otras aplicaciones

```ts
import { createCromi, KnowledgeBase, createKnowledgePlugin } from 'cromi-intelligence';

const base = new KnowledgeBase();
base.add({ id: 'manual', title: 'Guía de servicio', text: 'Horarios: lunes a viernes de 9 a 18.' });
const assistant = createCromi({ plugins: [createKnowledgePlugin(base)] });
console.log((await assistant.respond('¿Cuáles son los horarios?', 'visitante-1')).text);
```

Para integrar Ollama, reemplazá `createKnowledgePlugin(base)` con `createOllamaKnowledgePlugin(base)` **solo desde un proceso de servidor confiable**. La clase `KnowledgeBase` puede alojarse en memoria para casos pequeños o ser sustituida por un índice de producción que implemente controles por organización y usuario. La interfaz `widget/cromi-widget.js` se puede conectar al backend usando `apiEndpoint`.

Dependencias de código abierto para leer documentos: **Mozilla PDF.js** (Apache-2.0) y **Mammoth** (BSD-2-Clause). El núcleo conversacional y el widget son independientes de estos paquetes.

### Manejo de archivos defectuosos en la demo

La extracción de documentos ahora se ejecuta en un **proceso hijo local aislado del servidor HTTP**. Si un PDF o DOCX dañado provoca un error o interrumpe el analizador, el servidor sigue disponible y devuelve un error JSON en lugar de perder la conexión. Se limita el tiempo de extracción y el proceso no recibe credenciales del entorno principal. La interfaz muestra un aviso de conexión si la demo se detiene. Esto no sustituye controles de seguridad para un servicio de producción.

**Archivos grandes (64 MiB):** La demostración admite PDF/DOCX/TXT/MD de hasta 64 MiB y verifica el tamaño antes de enviarlo. La extracción se realiza en un proceso aislado con un máximo de 1.000 páginas PDF y 1.000.000 caracteres de texto extraído. Los archivos de gran tamaño pueden tardar y consumir mucha memoria. Los PDF escaneados sin texto siguen requiriendo OCR. La capacidad máxima es una decisión del integrador y no implica compatibilidad universal con cualquier PDF.