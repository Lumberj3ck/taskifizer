import { Notice, Plugin, TAbstractFile, TFile, debounce, moment, normalizePath } from "obsidian";
import { TaskifizerCore } from "./core";
import { TaskifizerSettings, loadSettings } from "./defaults";
import { TaskifizerSettingTab } from "./settings";
import { DAY_KEY, DayState, VIEW_TYPE } from "./types";
import { TaskifizerView, ViewHost } from "./view";

interface StoredData {
  settings: TaskifizerSettings;
  days: Record<string, DayState>;
}

interface CoreDailyNoteOptions {
  folder?: string;
  format?: string;
}

// Private Obsidian APIs, typed just enough to read daily note settings and run a command.
interface AppInternals {
  internalPlugins?: {
    getPluginById?(id: string): { enabled?: boolean; instance?: { options?: CoreDailyNoteOptions } } | null;
  };
  commands?: { executeCommandById?(id: string): boolean };
}

export default class TaskifizerPlugin extends Plugin implements ViewHost {
  core!: TaskifizerCore;

  private ready = false;
  private statusEl: HTMLElement | null = null;
  private requestSave = debounce(() => void this.persist(), 600, true);

  /** Same object as core.settings; the settings tab edits it in place. */
  settings!: TaskifizerSettings;

  async onload(): Promise<void> {
    const raw = (await this.loadData()) as Partial<StoredData> | null;
    this.core = new TaskifizerCore(
      {
        notify: (message) => new Notice(message),
        changed: () => {
          this.requestSave();
          this.updateViews();
        },
      },
      moment().format(DAY_KEY),
      loadSettings(raw?.settings),
      raw?.days ?? {},
    );
    this.settings = this.core.settings;

    this.registerView(VIEW_TYPE, (leaf) => new TaskifizerView(leaf, this));
    this.addRibbonIcon("layout-grid", "Open Taskifizer", () => void this.activateView());
    this.addCommand({ id: "open-field", name: "Open today's field", callback: () => void this.activateView() });
    this.addCommand({ id: "open-daily-note", name: "Open today's daily note", callback: () => void this.openDailyNote() });
    this.addSettingTab(new TaskifizerSettingTab(this.app, this));

    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("taskifizer-status", "mod-clickable");
    this.statusEl.setAttr("aria-label", "Open Taskifizer");
    this.statusEl.addEventListener("click", () => void this.activateView());

    this.app.workspace.onLayoutReady(() => void this.refresh());

    // The changed event hands over the new file content, so no extra read is needed.
    this.registerEvent(
      this.app.metadataCache.on("changed", (file, data) => {
        if (this.ready && file.path === this.dailyNotePath()) this.core.setContent(data, true);
      }),
    );
    const onFileEvent = (file: TAbstractFile, oldPath?: string) => {
      const p = this.dailyNotePath();
      if (file.path === p || oldPath === p) void this.refresh();
    };
    this.registerEvent(this.app.vault.on("create", (f) => onFileEvent(f)));
    this.registerEvent(this.app.vault.on("delete", (f) => onFileEvent(f)));
    this.registerEvent(this.app.vault.on("rename", (f, old) => onFileEvent(f, old)));

    // Pick up the new day after midnight.
    this.registerInterval(
      window.setInterval(() => {
        if (moment().format(DAY_KEY) !== this.core.todayKey) void this.refresh();
      }, 60_000),
    );
  }

  onunload(): void {
    void this.persist();
  }

  // ---------- daily note ----------

  coreDailyNoteOptions(): CoreDailyNoteOptions {
    const internals = this.app as unknown as AppInternals;
    return internals.internalPlugins?.getPluginById?.("daily-notes")?.instance?.options ?? {};
  }

  dailyNotePath(date = moment()): string {
    const core = this.coreDailyNoteOptions();
    const folder = (this.settings.dailyFolder || core.folder || "").replace(/^\/+|\/+$/g, "");
    const format = this.settings.dailyFormat || core.format || "YYYY-MM-DD";
    const name = date.format(format);
    return normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
  }

  async openDailyNote(): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.dailyNotePath());
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
      return;
    }
    // Prefer the core command so the user's daily note template is applied.
    const internals = this.app as unknown as AppInternals;
    const core = internals.internalPlugins?.getPluginById?.("daily-notes");
    if (core?.enabled && internals.commands?.executeCommandById?.("daily-notes")) return;

    const path = this.dailyNotePath();
    const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
    const created = await this.app.vault.create(path, "## Today\n\n- [ ] \n");
    await this.app.workspace.getLeaf(false).openFile(created);
  }

  async refresh(): Promise<void> {
    this.core.todayKey = moment().format(DAY_KEY);
    const file = this.app.vault.getAbstractFileByPath(this.dailyNotePath());
    this.core.setContent(file instanceof TFile ? await this.app.vault.cachedRead(file) : null, false);
    this.ready = true;
  }

  async resetToday(): Promise<void> {
    this.core.resetToday();
    await this.persist();
    await this.refresh();
  }

  // ---------- rendering & saving ----------

  updateViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof TaskifizerView) leaf.view.render();
    }
    if (this.statusEl) {
      const s = this.core.stats();
      const tail = s.left > 0 ? ` · ${s.left} to paint` : s.left < 0 ? ` · ${-s.left} owed` : "";
      this.statusEl.setText(`${s.painted}/${s.total}${tail}`);
    }
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) return;
      leaf = right;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
  }

  async saveSettings(): Promise<void> {
    await this.persist();
    // Prices or tags may have changed, so re-read today's tasks.
    await this.refresh();
  }

  private async persist(): Promise<void> {
    const data: StoredData = { settings: this.core.settings, days: this.core.days };
    await this.saveData(data);
  }
}
