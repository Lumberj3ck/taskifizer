// The plugin's state and rules, with no Obsidian dependency.
// main.ts feeds it the daily note's content; view.ts renders it.

import type { TaskifizerSettings } from "./defaults";
import { ParsedTask, TaskTotals, parseTasks, totals } from "./tasks";
import { Scene, hashString, makeScene } from "./scene";
import type { DayState } from "./types";

export interface CoreEvents {
  notify(message: string): void;
  changed(): void;
}

/** Moves a YYYY-MM-DD key by whole days. */
export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export interface DayStats {
  total: number;
  painted: number;
  /** Earned cells not painted yet. Negative when tasks were unticked after painting. */
  left: number;
  earned: number;
  tasks: TaskTotals;
}

export class TaskifizerCore {
  tasks: ParsedTask[] = [];
  noteFound = false;

  private paintedSets = new WeakMap<DayState, Set<number>>();
  private scenes = new Map<string, Scene>();

  constructor(
    private events: CoreEvents,
    public todayKey: string,
    public settings: TaskifizerSettings,
    public days: Record<string, DayState> = {},
  ) {}

  /** Feeds in today's note. Pass null when the note doesn't exist. */
  setContent(content: string | null, notify: boolean): void {
    const day = this.today();
    const before = totals(this.tasks);
    this.tasks = content === null ? [] : parseTasks(content, this.settings);
    this.noteFound = content !== null;
    const after = totals(this.tasks);

    if (notify) {
      if (after.done > before.done) this.events.notify(`+${after.done - before.done} cells to paint`);
      const total = this.total(day);
      if (before.planned < total && after.planned >= total) this.events.notify("Your plan now covers the whole field");
    }
    this.changed();
  }

  today(): DayState {
    let day = this.days[this.todayKey];
    if (!day) {
      const s = this.settings;
      day = {
        cols: s.cols,
        rows: s.rows,
        seed: hashString(this.todayKey),
        goldCount: s.goldCount,
        goldBonus: s.goldBonus,
        painted: [],
        earned: 0,
        planned: 0,
      };
      this.days[this.todayKey] = day;
    }
    return day;
  }

  paintedOf(day: DayState): Set<number> {
    let set = this.paintedSets.get(day);
    if (!set) {
      set = new Set(day.painted);
      this.paintedSets.set(day, set);
    }
    return set;
  }

  scene(day: DayState): Scene {
    const key = `${day.seed}:${day.cols}x${day.rows}:${day.goldCount}`;
    let sc = this.scenes.get(key);
    if (!sc) {
      sc = makeScene(day.seed, day.cols, day.rows, day.goldCount);
      this.scenes.set(key, sc);
    }
    return sc;
  }

  total(day: DayState): number {
    return day.cols * day.rows;
  }

  goldFound(day: DayState): number {
    const set = this.paintedOf(day);
    return this.scene(day).gold.filter((i) => set.has(i)).length;
  }

  stats(day = this.today()): DayStats {
    const t = totals(this.tasks);
    const painted = this.paintedOf(day).size;
    const earned = t.done + this.goldFound(day) * day.goldBonus;
    return { total: this.total(day), painted, left: earned - painted, earned, tasks: t };
  }

  isFull(key: string): boolean {
    const d = this.days[key];
    return !!d && d.painted.length >= d.cols * d.rows;
  }

  /** Consecutive fully painted days, ending today if today is full, otherwise yesterday. */
  streak(): number {
    let count = this.isFull(this.todayKey) ? 1 : 0;
    let key = shiftDay(this.todayKey, -1);
    while (this.isFull(key)) {
      count++;
      key = shiftDay(key, -1);
    }
    return count;
  }

  /** Paints one cell of today's field. Returns false if it's already painted or nothing is left to paint. */
  paint(i: number): boolean {
    const day = this.today();
    const set = this.paintedOf(day);
    const total = this.total(day);
    if (i < 0 || i >= total || set.has(i) || this.stats(day).left <= 0) return false;

    set.add(i);
    day.painted.push(i);
    if (this.scene(day).gold.includes(i)) this.events.notify(`Golden cell · +${day.goldBonus} cells`);
    if (set.size === total) this.events.notify("Field complete");
    this.changed();
    return true;
  }

  resetToday(): void {
    delete this.days[this.todayKey];
    this.changed();
  }

  private changed(): void {
    const day = this.today();
    const s = this.stats(day);
    day.earned = s.earned;
    day.planned = s.tasks.planned;
    this.events.changed();
  }
}
