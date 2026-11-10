import test from "node:test";
import assert from "node:assert/strict";
import { mountCromiWidget } from "../widget/cromi-widget.js";

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.className = "";
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.value = "";
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.classList = { add: (value) => { this.className += " " + value; } };
  }
  appendChild(node) { node.parent = this; this.children.push(node); return node; }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  attachShadow() { this.shadowRoot = new FakeElement("shadow"); return this.shadowRoot; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener() {}
  focus() {}
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this); }
  querySelectorAll(tag) {
    const result = [];
    const walk = (parent) => {
      for (const node of parent.children) {
        if (node.tagName === tag) result.push(node);
        walk(node);
      }
    };
    walk(this);
    return result;
  }
}

test("mounts an isolated, customizable chat and renders untrusted replies as text", async () => {
  const oldDocument = globalThis.document;
  const body = new FakeElement("body");
  globalThis.document = { body, baseURI: "https://example.org/", createElement: (tag) => new FakeElement(tag) };
  try {
    const received = [];
    const widget = mountCromiWidget({
      title: "Ayuda",
      position: "left",
      theme: "dark",
      accentColor: "#123abc",
      avatarUrl: "javascript:alert(1)",
      suggestions: ["Horarios"],
      respond: async (value) => { received.push(value); return { text: "<script>inofensivo</script>" }; },
    });
    const host = body.children[0];
    assert.equal(host.dataset.side, "left");
    assert.equal(host.dataset.theme, "dark");
    assert.equal(host.style["--cw-accent"], "#123abc");
    assert.equal(host.shadowRoot.querySelectorAll("img").length, 0);

    widget.open();
    assert.equal(widget.isOpen(), true);
    await widget.send("¿Horarios?");
    assert.equal(received.length, 1);
    assert.equal(received[0].message, "¿Horarios?");
    assert.ok(received[0].sessionId);
    const bubbles = host.shadowRoot.querySelectorAll("div").filter((node) => node.className === "cw-bubble");
    assert.equal(bubbles.at(-1).textContent, "<script>inofensivo</script>");
    assert.equal(host.shadowRoot.querySelectorAll("script").length, 0);
    widget.close();
    assert.equal(widget.isOpen(), false);
    widget.destroy();
    assert.equal(body.children.length, 0);
  } finally {
    globalThis.document = oldDocument;
  }
});
