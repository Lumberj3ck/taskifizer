// Runs the real plugin view (src/view.ts + src/core.ts) in a browser page next to a mock daily note.

import { Notice, WorkspaceLeaf } from "obsidian";
import { TaskifizerCore, shiftDay } from "../src/core";
import { DEFAULT_SETTINGS } from "../src/defaults";
import { hashString, rng } from "../src/scene";
import type { DayState } from "../src/types";
import { TaskifizerView } from "../src/view";

const TODAY = "2026-11-04";

interface Line {
  text: string;
  done: boolean;
}

const INITIAL: Line[] = [
  { text: "Morning run, 5 km #m", done: true },
  { text: "Reply to Lena's PR review #s", done: true },
  { text: "Write tests for the parser #m", done: false },
  { text: "Draft blog post outline #l", done: false },
  { text: "Inbox zero #s", done: false },
  { text: "Read 20 pages #s", done: false },
  { text: "Call the bank about the card #s", done: false },
  { text: "Gym: legs #m", done: false },
];

function shuffled(seed: number, n: number): number[] {
  const r = rng(seed);
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function exampleDays(): Record<string, DayState> {
  const days: Record<string, DayState> = {};
  const history: Array<[number, number]> = [
    [-6, 0.92],
    [-5, 1],
    [-4, 0.58],
    [-3, 1],
    [-2, 1],
    [-1, 1],
  ];
  for (const [offset, share] of history) {
    const key = shiftDay(TODAY, offset);
    const seed = hashString(key);
    const painted = shuffled(seed, 240).slice(0, Math.round(share * 240));
    days[key] = { cols: 20, rows: 12, seed, goldCount: 4, goldBonus: 6, painted, earned: painted.length, planned: 240 };
  }
  return days;
}

const $ = (id: string) => document.getElementById(id) as HTMLElement;

let lines: Line[] = [];
let view: TaskifizerView | null = null;

const core = new TaskifizerCore(
  {
    notify: (m) => new Notice(m),
    changed: () => {
      view?.render();
      renderStatus();
    },
  },
  TODAY,
  { ...DEFAULT_SETTINGS },
  exampleDays(),
);

function markdown(): string {
  return "## Today\n\n" + lines.map((l) => `- [${l.done ? "x" : " "}] ${l.text}`).join("\n") + "\n";
}

function renderStatus(): void {
  const s = core.stats();
  const tail = s.left > 0 ? ` · ${s.left} to paint` : s.left < 0 ? ` · ${-s.left} owed` : "";
  $("status-tz").textContent = `${s.painted}/${s.total}${tail}`;
}

// Tags and inline fields get Obsidian's tag styling.
const TOKEN_RE = /(#[A-Za-z][\w/-]*|\[cells::\s*\d+\s*\])/g;

function renderEditor(): void {
  const list = $("tasks");
  list.textContent = "";
  lines.forEach((line, idx) => {
    const li = document.createElement("li");
    li.className = "task" + (line.done ? " is-checked" : "");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = `task-${idx}`;
    box.checked = line.done;
    box.addEventListener("change", () => {
      line.done = box.checked;
      li.classList.toggle("is-checked", line.done);
      core.setContent(markdown(), true);
    });
    const label = document.createElement("label");
    label.htmlFor = box.id;
    let last = 0;
    for (const m of line.text.matchAll(TOKEN_RE)) {
      label.append(line.text.slice(last, m.index));
      const tag = document.createElement("span");
      tag.className = m[0].startsWith("#") ? "tag" : "field";
      tag.textContent = m[0];
      label.append(tag);
      last = (m.index ?? 0) + m[0].length;
    }
    label.append(line.text.slice(last));
    li.append(box, label);
    list.append(li);
  });
}

function reset(): void {
  lines = INITIAL.map((l) => ({ ...l }));
  core.days = exampleDays();
  core.setContent(markdown(), false);

  // Example progress: 28 cells already painted near the middle of today's field.
  const day = core.today();
  const gold = new Set(core.scene(day).gold);
  const order = [...Array(240).keys()]
    .filter((i) => !gold.has(i))
    .sort((a, b) => Math.hypot((a % 20) - 12, Math.floor(a / 20) - 4.5) - Math.hypot((b % 20) - 12, Math.floor(b / 20) - 4.5));
  for (const i of order.slice(0, 28)) core.paint(i);

  renderEditor();
  view?.render();
}

$("add").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("add-input") as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;
  lines.push({ text, done: false });
  input.value = "";
  renderEditor();
  core.setContent(markdown(), true);
});
$("reset").addEventListener("click", () => {
  reset();
  view = new TaskifizerView(new WorkspaceLeaf($("tz-root")), { core, openDailyNote: () => undefined });
  void view.onOpen();
});

reset();
view = new TaskifizerView(new WorkspaceLeaf($("tz-root")), { core, openDailyNote: () => undefined });
void view.onOpen();
renderStatus();
