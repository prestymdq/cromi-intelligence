/**
 * Cromi Widget — dependency-free, framework-neutral browser chat.
 *
 * Import mountCromiWidget() from this module. It creates an isolated Shadow DOM
 * interface and delegates messages to an app-provided respond() callback or a
 * JSON POST API. It does not use external services by itself.
 */
const ICONS = {
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l.9-4.5a9 9 0 1 1 16.1-4Z"/><path d="M8 12h8M8 15h5"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6 18 18M18 6 6 18"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-8-8 18-2.5-7.5L3 11Z"/><path d="M10.5 13.5 21 3"/></svg>',
  bot: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M9 3h6M1.5 13H4M20 13h2.5"/><path d="M9 13h.01M15 13h.01M9 17h6"/></svg>',
};

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = String(text);
  return item;
}

function icon(name) {
  const node = element("span", "cw-icon");
  // Internal, fixed SVG strings only. User and API content always uses textContent.
  node.innerHTML = ICONS[name];
  return node;
}

function safeImageUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value), document.baseURI);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function safeColor(color) {
  return typeof color === "string" && /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(color)
    ? color : "#4f46e5";
}

function makeSessionId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function makeResponder(config) {
  if (typeof config.respond === "function") return config.respond;
  if (typeof config.apiEndpoint !== "string" || !config.apiEndpoint.trim()) {
    return async () => ({ text: "Este asistente todavía no tiene una fuente de respuestas configurada." });
  }
  let endpoint;
  try { endpoint = new URL(config.apiEndpoint, document.baseURI); }
  catch { throw new TypeError("apiEndpoint debe ser una URL válida."); }
  if (!["https:", "http:"].includes(endpoint.protocol)) throw new TypeError("apiEndpoint debe usar HTTP(S).");
  return async ({ message, sessionId }) => {
    const response = await fetch(endpoint.href, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ message, sessionId }),
    });
    if (!response.ok) throw new Error("El servicio no respondió correctamente.");
    return response.json();
  };
}

/**
 * @param {object} options
 * @param {Element} [options.target=document.body] Container for the widget.
 * @param {string} [options.title="Asistente"] Visible title.
 * @param {string} [options.subtitle="Estamos para ayudarte"] Header status.
 * @param {string} [options.welcome="¡Hola! ¿En qué puedo ayudarte?"] First reply.
 * @param {string} [options.avatarUrl] Optional HTTP(S) image, owned by the integrator.
 * @param {string} [options.accentColor="#4f46e5"] Accent hex color.
 * @param {"left"|"right"} [options.position="right"] Launcher position.
 * @param {"auto"|"light"|"dark"} [options.theme="auto"] Color scheme.
 * @param {string[]} [options.suggestions=[]] Quick question buttons.
 * @param {string} [options.apiEndpoint] Same-origin POST endpoint, or CORS-enabled external endpoint.
 * @param {(input:{message:string, sessionId:string})=>Promise<{text:string}>} [options.respond]
 * @returns {{open:Function, close:Function, send:Function, destroy:Function, isOpen:Function}}
 */
export function mountCromiWidget(options = {}) {
  if (typeof document === "undefined") throw new Error("Cromi Widget necesita un navegador.");
  const target = options.target ?? document.body;
  if (!target || typeof target.appendChild !== "function") throw new TypeError("target debe ser un elemento DOM.");
  const config = {
    title: String(options.title ?? "Asistente").slice(0, 72),
    subtitle: String(options.subtitle ?? "Estamos para ayudarte").slice(0, 80),
    welcome: String(options.welcome ?? "¡Hola! ¿En qué puedo ayudarte?").slice(0, 4000),
    placeholder: String(options.placeholder ?? "Escribí tu consulta…").slice(0, 100),
    launcherLabel: String(options.launcherLabel ?? "Abrir asistente").slice(0, 80),
    position: options.position === "left" ? "left" : "right",
    theme: ["light", "dark"].includes(options.theme) ? options.theme : "auto",
    accentColor: safeColor(options.accentColor),
    avatarUrl: safeImageUrl(options.avatarUrl),
    suggestions: Array.isArray(options.suggestions) ? options.suggestions.filter((s) => typeof s === "string" && s.trim()).slice(0, 5) : [],
    maxInputLength: Number.isSafeInteger(options.maxInputLength)
      ? Math.min(5000, Math.max(50, options.maxInputLength)) : 2000,
  };
  const respond = makeResponder(options);
  const sessionId = makeSessionId();
  const host = element("div");
  host.className = "cromi-widget-host";
  host.style.setProperty("--cw-accent", config.accentColor);
  host.dataset.side = config.position;
  host.dataset.theme = config.theme;
  const shadow = host.attachShadow({ mode: "open" });
  const style = element("link");
  style.rel = "stylesheet";
  style.href = new URL("./cromi-widget.css", import.meta.url).href;
  shadow.appendChild(style);

  const root = element("div", "cw-root");
  const launcher = element("button", "cw-launcher");
  launcher.type = "button";
  launcher.setAttribute("aria-label", config.launcherLabel);
  launcher.setAttribute("aria-expanded", "false");
  launcher.appendChild(icon("chat"));

  const panel = element("section", "cw-panel");
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", config.title);

  const header = element("header", "cw-header");
  const avatar = element("span", "cw-avatar");
  if (config.avatarUrl) {
    const img = element("img");
    img.src = config.avatarUrl;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    avatar.appendChild(img);
  } else {
    avatar.appendChild(icon("bot"));
  }
  const identity = element("div", "cw-identity");
  identity.appendChild(element("strong", "cw-title", config.title));
  identity.appendChild(element("span", "cw-subtitle", config.subtitle));
  const close = element("button", "cw-close");
  close.type = "button";
  close.setAttribute("aria-label", "Cerrar chat");
  close.appendChild(icon("close"));
  header.append(avatar, identity, close);

  const transcript = element("div", "cw-messages");
  transcript.setAttribute("role", "log");
  transcript.setAttribute("aria-live", "polite");
  transcript.setAttribute("aria-relevant", "additions");
  transcript.setAttribute("aria-label", "Mensajes de la conversación");

  const suggestions = element("div", "cw-suggestions");
  suggestions.setAttribute("aria-label", "Preguntas sugeridas");

  const form = element("form", "cw-form");
  const input = element("textarea", "cw-input");
  input.rows = 1;
  input.maxLength = config.maxInputLength;
  input.placeholder = config.placeholder;
  input.setAttribute("aria-label", "Escribí tu mensaje");
  const submit = element("button", "cw-submit");
  submit.type = "submit";
  submit.disabled = true;
  submit.setAttribute("aria-label", "Enviar mensaje");
  submit.appendChild(icon("send"));
  form.append(input, submit);
  panel.append(header, transcript, suggestions, form);
  root.append(panel, launcher);
  shadow.appendChild(root);
  target.appendChild(host);

  let opened = false;
  let pending = false;
  let destroyed = false;
  let hasInteracted = false;

  function addMessage(sender, text, busy = false) {
    const row = element("div", "cw-message cw-" + sender);
    const bubble = element("div", "cw-bubble", text);
    if (busy) bubble.classList.add("cw-waiting");
    row.appendChild(bubble);
    transcript.appendChild(row);
    transcript.scrollTop = transcript.scrollHeight;
    return row;
  }

  function refreshSubmit() {
    submit.disabled = pending || !input.value.trim();
    suggestions.querySelectorAll("button").forEach((button) => { button.disabled = pending; });
  }

  function setOpened(value) {
    if (destroyed) return;
    opened = Boolean(value);
    panel.hidden = !opened;
    launcher.setAttribute("aria-expanded", String(opened));
    host.dataset.open = String(opened);
    if (opened) {
      input.focus({ preventScroll: true });
      transcript.scrollTop = transcript.scrollHeight;
    } else launcher.focus({ preventScroll: true });
  }

  async function send(message) {
    if (destroyed || pending) return;
    const text = String(message ?? "").trim().slice(0, config.maxInputLength);
    if (!text) return;
    if (!opened) setOpened(true);
    hasInteracted = true;
    suggestions.hidden = true;
    input.value = "";
    addMessage("user", text);
    pending = true;
    refreshSubmit();
    const waiting = addMessage("assistant", "Consultando…", true);
    try {
      const result = await respond({ message: text, sessionId });
      if (destroyed) return;
      waiting.remove();
      const reply = typeof result === "string" ? result : result?.text;
      addMessage("assistant", typeof reply === "string" && reply.trim() ? reply : "No tengo una respuesta disponible para esa consulta.");
    } catch {
      if (destroyed) return;
      waiting.remove();
      addMessage("assistant", "No pude procesar esa consulta. Probá nuevamente.");
    } finally {
      pending = false;
      if (!destroyed) { refreshSubmit(); input.focus({ preventScroll: true }); }
    }
  }

  addMessage("assistant", config.welcome);
  for (const question of config.suggestions) {
    const button = element("button", "cw-suggestion", question);
    button.type = "button";
    button.addEventListener("click", () => void send(question));
    suggestions.appendChild(button);
  }
  if (!config.suggestions.length) suggestions.hidden = true;

  launcher.addEventListener("click", () => setOpened(!opened));
  close.addEventListener("click", () => setOpened(false));
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); setOpened(false); }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void send(input.value);
  });
  input.addEventListener("input", refreshSubmit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!pending && input.value.trim()) void send(input.value);
    }
  });
  refreshSubmit();
  return {
    open: () => setOpened(true),
    close: () => setOpened(false),
    isOpen: () => opened,
    send,
    destroy: () => { if (destroyed) return; destroyed = true; host.remove(); },
  };
}
