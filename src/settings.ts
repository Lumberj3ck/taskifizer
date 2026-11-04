import { App, Modal, PluginSettingTab, Setting } from "obsidian";
import type TaskifizerPlugin from "./main";
import { DEFAULT_SETTINGS } from "./defaults";

class ConfirmModal extends Modal {
  constructor(app: App, private message: string, private onConfirm: () => void) {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText("Reset today's field?");
    this.contentEl.createEl("p", { text: this.message });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText("Reset")
          .setWarning()
          .onClick(() => {
            this.onConfirm();
            this.close();
          }),
      );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}

export class TaskifizerSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: TaskifizerPlugin) {
    super(app, plugin);
  }

  private numberSetting(
    el: HTMLElement,
    name: string,
    desc: string,
    get: () => number,
    set: (n: number) => void,
    min: number,
    max: number,
  ): Setting {
    return new Setting(el)
      .setName(name)
      .setDesc(desc)
      .addText((t) => {
        t.inputEl.type = "number";
        t.inputEl.min = String(min);
        t.inputEl.max = String(max);
        t.inputEl.addClass("taskifizer-num");
        t.setValue(String(get()));
        t.onChange(async (v) => {
          const n = Math.round(Number(v));
          if (!Number.isFinite(n) || n < min || n > max) return;
          set(n);
          await this.plugin.saveSettings();
        });
      });
  }

  display(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    containerEl.empty();

    // Field
    new Setting(containerEl).setName("Field").setHeading();
    this.numberSetting(containerEl, "Columns", "Width of the field in cells. Applies from the next day.", () => s.cols, (n) => (s.cols = n), 4, 60);
    this.numberSetting(containerEl, "Rows", "Height of the field in cells. Applies from the next day.", () => s.rows, (n) => (s.rows = n), 3, 40);
    new Setting(containerEl)
      .setName("Reset today's field")
      .setDesc("Clears every cell you painted today and starts today again with the current field size and golden cell settings.")
      .addButton((b) =>
        b
          .setButtonText("Reset")
          .setWarning()
          .onClick(() =>
            new ConfirmModal(this.app, "All cells painted today will be cleared. Your tasks are not changed.", () => {
              void this.plugin.resetToday();
            }).open(),
          ),
      );

    // Prices
    new Setting(containerEl)
      .setName("Task prices")
      .setDesc("Tag a task with a size to set how many cells it earns, or write [cells:: 30] for a custom price.")
      .setHeading();
    const sizes: Array<["small" | "medium" | "large", string]> = [
      ["small", "Small"],
      ["medium", "Medium"],
      ["large", "Large"],
    ];
    for (const [key, label] of sizes) {
      const tagKey = `${key}Tag` as const;
      const priceKey = `${key}Price` as const;
      new Setting(containerEl)
        .setName(`${label} task`)
        .setDesc("Tag without # and its price in cells.")
        .addText((t) =>
          t
            .setPlaceholder(DEFAULT_SETTINGS[tagKey])
            .setValue(s[tagKey])
            .onChange(async (v) => {
              s[tagKey] = v.trim().replace(/^#/, "");
              await this.plugin.saveSettings();
            }),
        )
        .addText((t) => {
          t.inputEl.type = "number";
          t.inputEl.min = "0";
          t.inputEl.addClass("taskifizer-num");
          t.setValue(String(s[priceKey])).onChange(async (v) => {
            const n = Math.round(Number(v));
            if (!Number.isFinite(n) || n < 0 || n > 10000) return;
            s[priceKey] = n;
            await this.plugin.saveSettings();
          });
        });
    }
    this.numberSetting(containerEl, "Untagged task price", "Cells earned by a task with no size tag. Set 0 to ignore untagged tasks.", () => s.defaultPrice, (n) => (s.defaultPrice = n), 0, 10000);
    this.numberSetting(containerEl, "Maximum custom price", "Upper limit for [cells:: n], so one task can't buy the whole field. Set 0 for no limit.", () => s.maxCustomPrice, (n) => (s.maxCustomPrice = n), 0, 10000);

    // Golden cells
    new Setting(containerEl).setName("Golden cells").setHeading();
    this.numberSetting(containerEl, "Golden cells per day", "Painting one gives you bonus cells. Applies from the next day.", () => s.goldCount, (n) => (s.goldCount = n), 0, 50);
    this.numberSetting(containerEl, "Bonus per golden cell", "Applies from the next day.", () => s.goldBonus, (n) => (s.goldBonus = n), 0, 1000);
    new Setting(containerEl)
      .setName("Show golden cells in advance")
      .setDesc("Off makes them a surprise you only find by painting.")
      .addToggle((t) =>
        t.setValue(s.showGold).onChange(async (v) => {
          s.showGold = v;
          await this.plugin.saveSettings();
        }),
      );

    // Daily notes
    const core = this.plugin.coreDailyNoteOptions();
    new Setting(containerEl)
      .setName("Daily notes")
      .setDesc("Leave empty to use the core Daily notes settings.")
      .setHeading();
    new Setting(containerEl)
      .setName("Folder")
      .setDesc(`Currently reading: ${this.plugin.dailyNotePath()}`)
      .addText((t) =>
        t
          .setPlaceholder(core.folder || "(vault root)")
          .setValue(s.dailyFolder)
          .onChange(async (v) => {
            s.dailyFolder = v.trim();
            await this.plugin.saveSettings();
          }),
      );
    new Setting(containerEl)
      .setName("File name format")
      .setDesc("Moment.js format, for example YYYY-MM-DD.")
      .addText((t) =>
        t
          .setPlaceholder(core.format || "YYYY-MM-DD")
          .setValue(s.dailyFormat)
          .onChange(async (v) => {
            s.dailyFormat = v.trim();
            await this.plugin.saveSettings();
          }),
      );
  }
}
