import type { PriceSettings } from "./tasks";

export interface TaskifizerSettings extends PriceSettings {
  cols: number;
  rows: number;
  goldCount: number;
  goldBonus: number;
  showGold: boolean;
  /** Overrides for the core Daily notes settings. Empty means use the core plugin's value. */
  dailyFolder: string;
  dailyFormat: string;
}

export const DEFAULT_SETTINGS: TaskifizerSettings = {
  cols: 20,
  rows: 12,
  smallTag: "s",
  mediumTag: "m",
  largeTag: "l",
  smallPrice: 12,
  mediumPrice: 24,
  largePrice: 48,
  defaultPrice: 12,
  maxCustomPrice: 100,
  goldCount: 4,
  goldBonus: 6,
  showGold: true,
  dailyFolder: "",
  dailyFormat: "",
};

/** Keeps only known settings, so stale keys from older versions are dropped. */
export function loadSettings(saved: unknown): TaskifizerSettings {
  const out: TaskifizerSettings = { ...DEFAULT_SETTINGS };
  if (saved && typeof saved === "object") {
    const src = saved as Record<string, unknown>;
    const target = out as unknown as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key in src && typeof src[key] === typeof target[key]) target[key] = src[key];
    }
  }
  return out;
}
