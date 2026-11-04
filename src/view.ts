import { ItemView, Notice, WorkspaceLeaf, moment } from "obsidian";
import type { TaskifizerCore } from "./core";
import type { Scene } from "./scene";
import { DAY_KEY, DayState, VIEW_TYPE } from "./types";

export interface ViewHost {
  core: TaskifizerCore;
  openDailyNote(): void | Promise<void>;
}

const THUMB_PX = 4;

function drawThumb(canvas: HTMLCanvasElement, day: DayState, scene: Scene): void {
  canvas.width = day.cols * THUMB_PX;
  canvas.height = day.rows * THUMB_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  for (const i of day.painted) {
    ctx.fillStyle = scene.colors[i];
    ctx.fillRect((i % day.cols) * THUMB_PX, Math.floor(i / day.cols) * THUMB_PX, THUMB_PX, THUMB_PX);
  }
}

function retrigger(el: HTMLElement, cls: string): void {
  el.removeClass(cls);
  void el.offsetWidth;
  el.addClass(cls);
}

export class TaskifizerView extends ItemView {
  private builtFor = "";
  private cells: HTMLElement[] = [];
  private drawing = false;
  private warned = false;
  private weekQueued = false;

  private streakEl!: HTMLElement;
  private frameEl!: HTMLElement;
  private fieldEl!: HTMLElement;
  private paintedEl!: HTMLElement;
  private inkEl!: HTMLElement;
  private inkNum!: HTMLElement;
  private inkCap!: HTMLElement;
  private segPainted!: HTMLElement;
  private segReady!: HTMLElement;
  private segPlanned!: HTMLElement;
  private segGap!: HTMLElement;
  private planLeft!: HTMLElement;
  private planRight!: HTMLElement;
  private missingEl!: HTMLElement;
  private weekEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private host: ViewHost) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }
  getDisplayText(): string {
    return "Taskifizer";
  }
  getIcon(): string {
    return "layout-grid";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
    this.builtFor = "";
  }

  render(): void {
    const core = this.host.core;
    const day = core.today();
    const key = `${core.todayKey}:${day.cols}x${day.rows}:${day.seed}:${day.goldCount}:${core.settings.showGold}`;
    if (key !== this.builtFor) {
      this.build(day);
      this.builtFor = key;
    }
    this.update(day);
  }

  // ---------- structure, built once per day ----------

  private build(day: DayState): void {
    const core = this.host.core;
    const root = this.contentEl;
    root.empty();
    root.addClass("taskifizer");

    const date = moment(core.todayKey, DAY_KEY);
    const top = root.createDiv("tz-top");
    const heading = top.createDiv();
    heading.createDiv({ cls: "tz-weekday", text: date.format("dddd") });
    heading.createDiv({ cls: "tz-date", text: date.format("MMMM D") });
    this.streakEl = top.createDiv("tz-streak");

    this.frameEl = root.createDiv("tz-frame");
    this.fieldEl = this.frameEl.createDiv("tz-field tz-no-anim");
    this.fieldEl.style.setProperty("--tz-cols", String(day.cols));
    this.fieldEl.toggleClass("show-gold", core.settings.showGold);
    const gold = new Set(core.scene(day).gold);
    this.cells = [];
    for (let i = 0; i < core.total(day); i++) {
      const c = this.fieldEl.createDiv("tz-cell");
      c.dataset.i = String(i);
      if (gold.has(i)) c.addClass("is-gold");
      this.cells.push(c);
    }
    // Cells painted earlier appear without animation; new paint animates.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => this.fieldEl.removeClass("tz-no-anim")));
    this.bindPainting();

    const stats = root.createDiv("tz-stats");
    const painted = stats.createDiv("tz-stat");
    this.paintedEl = painted.createDiv("tz-num");
    painted.createDiv({ cls: "tz-cap", text: "painted" });
    this.inkEl = stats.createDiv("tz-stat tz-ink");
    this.inkNum = this.inkEl.createDiv("tz-num");
    this.inkCap = this.inkEl.createDiv("tz-cap");

    const plan = root.createDiv("tz-plan");
    const meter = plan.createDiv("tz-meter");
    this.segPainted = meter.createDiv("tz-seg tz-seg-painted");
    this.segReady = meter.createDiv("tz-seg tz-seg-ready");
    this.segPlanned = meter.createDiv("tz-seg tz-seg-planned");
    this.segGap = meter.createDiv("tz-seg tz-seg-gap");
    const caption = plan.createDiv("tz-plan-caption");
    this.planLeft = caption.createSpan();
    this.planRight = caption.createSpan("tz-plan-state");

    this.missingEl = root.createDiv("tz-missing");
    this.missingEl.createSpan({ text: "No daily note for today" });
    const create = this.missingEl.createEl("button", { cls: "tz-link", text: "Create" });
    create.addEventListener("click", () => void this.host.openDailyNote());

    this.weekEl = root.createDiv("tz-week");
  }

  private bindPainting(): void {
    const field = this.fieldEl;
    const paintAt = (e: PointerEvent) => {
      const el = field.doc.elementFromPoint(e.clientX, e.clientY);
      if (!(el instanceof HTMLElement) || el.parentElement !== field) return;
      const i = Number(el.dataset.i);
      const core = this.host.core;
      if (core.paint(i)) {
        if (el.hasClass("is-gold")) retrigger(el, "tz-burst");
        return;
      }
      const day = core.today();
      if (!core.paintedOf(day).has(i) && core.stats(day).left <= 0 && !this.warned) {
        this.warned = true;
        retrigger(this.inkEl, "tz-shake");
        new Notice(core.stats(day).left < 0 ? "Finish a task to pay back the cells you owe" : "Finish a task to earn more cells");
      }
    };
    field.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.drawing = true;
      this.warned = false;
      try {
        field.setPointerCapture(e.pointerId);
      } catch {
        /* capture is optional */
      }
      paintAt(e);
    });
    field.addEventListener("pointermove", (e) => {
      if (this.drawing) paintAt(e);
    });
    const stop = () => (this.drawing = false);
    field.addEventListener("pointerup", stop);
    field.addEventListener("pointercancel", stop);
    field.addEventListener("lostpointercapture", stop);
  }

  // ---------- state, updated on every change ----------

  private update(day: DayState): void {
    const core = this.host.core;
    const s = core.stats(day);
    const set = core.paintedOf(day);
    const colors = core.scene(day).colors;
    const full = s.painted === s.total;

    // Streak
    const streak = core.streak();
    this.streakEl.toggle(streak > 0);
    this.streakEl.empty();
    this.streakEl.createSpan({ cls: "tz-streak-n", text: String(streak) });
    this.streakEl.appendText(streak === 1 ? " day" : " days");
    this.streakEl.setAttr("aria-label", "Days in a row with a full field");

    // Cells
    this.fieldEl.toggleClass("can-paint", s.left > 0);
    this.frameEl.toggleClass("is-complete", full);
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      const on = set.has(i);
      if (on && !c.hasClass("is-on")) {
        c.style.setProperty("--tz-c", colors[i]);
        c.addClass("is-on");
      } else if (!on && c.hasClass("is-on")) {
        c.removeClass("is-on");
      }
    }

    // Numbers
    this.paintedEl.empty();
    this.paintedEl.appendText(String(s.painted));
    this.paintedEl.createSpan({ cls: "tz-of", text: `/${s.total}` });

    this.inkEl.toggleClass("is-ready", s.left > 0);
    this.inkEl.toggleClass("is-owed", s.left < 0);
    this.inkNum.setText(String(Math.abs(s.left)));
    this.inkCap.setText(s.left < 0 ? "owed" : full ? "done for today" : "to paint");

    // Meter: painted, earned but unpainted, planned but unfinished, missing.
    const pct = (n: number) => `${(Math.max(0, n) / s.total) * 100}%`;
    const painted = Math.min(s.total, s.painted);
    const ready = Math.min(s.total - painted, Math.max(0, s.left));
    const planned = Math.min(s.total - painted - ready, s.tasks.planned - s.tasks.done);
    const gap = s.total - painted - ready - Math.max(0, planned);
    this.segPainted.style.width = pct(painted);
    this.segReady.style.width = pct(ready);
    this.segPlanned.style.width = pct(planned);
    this.segGap.style.width = pct(gap);
    this.segPainted.setAttr("aria-label", `${painted} painted`);
    this.segReady.setAttr("aria-label", `${ready} ready to paint`);
    this.segPlanned.setAttr("aria-label", `${Math.max(0, planned)} in unfinished tasks`);
    this.segGap.setAttr("aria-label", `${gap} not covered by any task`);

    const short = s.total - s.tasks.planned;
    this.planLeft.setText(`Planned ${s.tasks.planned} of ${s.total}`);
    this.planRight.setText(full ? "Complete" : short > 0 ? `${short} short` : "Covered");
    this.planRight.toggleClass("is-short", !full && short > 0);
    this.segGap.toggleClass("is-short", short > 0);

    this.missingEl.toggle(!core.noteFound);

    this.queueWeek();
  }

  private queueWeek(): void {
    if (this.weekQueued) return;
    this.weekQueued = true;
    window.requestAnimationFrame(() => {
      this.weekQueued = false;
      this.renderWeek();
    });
  }

  private renderWeek(): void {
    const core = this.host.core;
    this.weekEl.empty();
    const today = moment(core.todayKey, DAY_KEY);
    for (let k = 6; k >= 0; k--) {
      const m = today.clone().subtract(k, "days");
      const d = core.days[m.format(DAY_KEY)];
      const cell = this.weekEl.createDiv("tz-day");
      if (k === 0) cell.addClass("is-today");
      const canvas = cell.createEl("canvas");
      let pct = 0;
      if (d) {
        drawThumb(canvas, d, core.scene(d));
        pct = Math.round((d.painted.length / (d.cols * d.rows)) * 100);
      } else {
        canvas.width = 80;
        canvas.height = 48;
      }
      cell.toggleClass("is-full", pct >= 100);
      cell.setAttr("aria-label", `${m.format("ddd, MMM D")} · ${pct}%`);
      cell.createDiv({ cls: "tz-day-label", text: m.format("dd").charAt(0) });
    }
  }
}
