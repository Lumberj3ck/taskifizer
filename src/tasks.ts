// Pure task parsing and pricing. No Obsidian imports, so it can be unit tested with plain Node.

export type TaskStatus = "open" | "done" | "cancelled";

export interface ParsedTask {
  line: number;
  text: string;
  status: TaskStatus;
  price: number;
}

export interface PriceSettings {
  smallTag: string;
  mediumTag: string;
  largeTag: string;
  smallPrice: number;
  mediumPrice: number;
  largePrice: number;
  /** Price of a task with no size tag or custom price. 0 means it earns nothing. */
  defaultPrice: number;
  /** Upper limit for [cells:: n]. 0 means no limit. */
  maxCustomPrice: number;
}

// "- [ ] text", "* [x] text", "1. [ ] text", also inside blockquotes/callouts ("> - [ ] text").
const TASK_RE = /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[(.)\]\s+(.*)$/;
// Dataview-style inline field, bracket or paren form: [cells:: 30] or (cells:: 30)
const CUSTOM_RE = /[[(]cells::\s*(\d+)\s*[\])]/i;
const FENCE_RE = /^\s*(?:>\s*)*(```|~~~)/;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasTag(text: string, tag: string): boolean {
  const t = tag.trim().replace(/^#/, "");
  if (!t) return false;
  return new RegExp(`(^|\\s)#${escapeRe(t)}(?=$|[\\s,.;:!?)\\]])`, "i").test(text);
}

export function priceOf(text: string, s: PriceSettings): number {
  const custom = CUSTOM_RE.exec(text);
  if (custom) {
    const n = parseInt(custom[1], 10);
    return s.maxCustomPrice > 0 ? Math.min(n, s.maxCustomPrice) : n;
  }
  if (hasTag(text, s.largeTag)) return s.largePrice;
  if (hasTag(text, s.mediumTag)) return s.mediumPrice;
  if (hasTag(text, s.smallTag)) return s.smallPrice;
  return s.defaultPrice;
}

function statusOf(ch: string): TaskStatus {
  if (ch === "x" || ch === "X") return "done";
  if (ch === "-") return "cancelled";
  return "open";
}

export function parseTasks(content: string, s: PriceSettings): ParsedTask[] {
  const lines = content.split(/\r?\n/);
  const tasks: ParsedTask[] = [];
  let start = 0;

  // Skip YAML frontmatter.
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end > 0) start = end + 1;
  }

  let fence: string | null = null;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const f = FENCE_RE.exec(line);
    if (f) {
      if (fence === null) fence = f[1];
      else if (fence === f[1]) fence = null;
      continue;
    }
    if (fence !== null) continue;

    const m = TASK_RE.exec(line);
    if (!m) continue;
    const text = m[2].trim();
    if (!text) continue; // empty template checkboxes like "- [ ] "
    tasks.push({ line: i, text, status: statusOf(m[1]), price: priceOf(text, s) });
  }
  return tasks;
}

export interface TaskTotals {
  /** Cells earned by finished tasks. */
  done: number;
  /** Cells all non-cancelled tasks are worth together. */
  planned: number;
  doneCount: number;
  openCount: number;
}

export function totals(tasks: ParsedTask[]): TaskTotals {
  const t: TaskTotals = { done: 0, planned: 0, doneCount: 0, openCount: 0 };
  for (const task of tasks) {
    if (task.status === "cancelled") continue;
    t.planned += task.price;
    if (task.status === "done") {
      t.done += task.price;
      t.doneCount++;
    } else {
      t.openCount++;
    }
  }
  return t;
}
