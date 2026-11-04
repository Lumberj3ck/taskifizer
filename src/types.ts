/** Storage key format for days. Independent of the daily note file name format. */
export const DAY_KEY = "YYYY-MM-DD";

export const VIEW_TYPE = "taskifizer-field";

/** Everything saved for one day. Field size and golden cells are frozen when the day starts. */
export interface DayState {
  cols: number;
  rows: number;
  seed: number;
  goldCount: number;
  goldBonus: number;
  /** Indices of painted cells, in painting order. */
  painted: number[];
  /** Last known cells earned (tasks + golden bonuses). Kept for history. */
  earned: number;
  /** Last known total price of the day's tasks. Kept for history. */
  planned: number;
}
