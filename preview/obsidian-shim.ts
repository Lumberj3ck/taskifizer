// Just enough of the Obsidian API to run src/view.ts in a plain browser page.
// Used only by the preview build (preview/build.mjs aliases "obsidian" to this file).

import momentLib from "moment";

export const moment = momentLib;

type DomInfo = string | { cls?: string | string[]; text?: string; attr?: Record<string, string> } | undefined;

const P = HTMLElement.prototype as unknown as Record<string, unknown>;

P.createEl = function (this: HTMLElement, tag: string, o?: DomInfo) {
  const el = document.createElement(tag);
  if (typeof o === "string") el.className = o;
  else if (o) {
    if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
    if (o.text != null) el.textContent = o.text;
    if (o.attr) for (const [k, v] of Object.entries(o.attr)) el.setAttribute(k, v);
  }
  this.appendChild(el);
  return el;
};
P.createDiv = function (this: HTMLElement & { createEl: (t: string, o?: DomInfo) => HTMLElement }, o?: DomInfo) {
  return this.createEl("div", o);
};
P.createSpan = function (this: HTMLElement & { createEl: (t: string, o?: DomInfo) => HTMLElement }, o?: DomInfo) {
  return this.createEl("span", o);
};
P.empty = function (this: HTMLElement) {
  while (this.firstChild) this.removeChild(this.firstChild);
};
P.setText = function (this: HTMLElement, t: string) {
  this.textContent = t;
};
P.appendText = function (this: HTMLElement, t: string) {
  this.appendChild(document.createTextNode(t));
};
P.addClass = function (this: HTMLElement, ...c: string[]) {
  this.classList.add(...c);
};
P.removeClass = function (this: HTMLElement, ...c: string[]) {
  this.classList.remove(...c);
};
P.toggleClass = function (this: HTMLElement, c: string, v: boolean) {
  this.classList.toggle(c, v);
};
P.hasClass = function (this: HTMLElement, c: string) {
  return this.classList.contains(c);
};
P.setAttr = function (this: HTMLElement, k: string, v: unknown) {
  this.setAttribute(k, String(v));
};
P.toggle = function (this: HTMLElement, show: boolean) {
  this.style.display = show ? "" : "none";
};
Object.defineProperty(Node.prototype, "doc", {
  get(this: Node) {
    return this.ownerDocument;
  },
});

export class Notice {
  constructor(message: string) {
    const host = document.getElementById("notices");
    if (!host) return;
    const n = document.createElement("div");
    n.className = "notice";
    n.textContent = message;
    host.appendChild(n);
    setTimeout(() => {
      n.classList.add("is-leaving");
      setTimeout(() => n.remove(), 250);
    }, 3000);
  }
}

export class WorkspaceLeaf {
  constructor(public containerEl: HTMLElement) {}
}

export class ItemView {
  contentEl: HTMLElement;
  constructor(public leaf: WorkspaceLeaf) {
    this.contentEl = leaf.containerEl;
  }
}
