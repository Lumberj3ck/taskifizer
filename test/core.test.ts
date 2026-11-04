import { test } from "node:test";
import assert from "node:assert/strict";
import { TaskifizerCore, shiftDay } from "../src/core";
import { DEFAULT_SETTINGS, loadSettings } from "../src/defaults";

function makeCore() {
  const notices: string[] = [];
  const core = new TaskifizerCore({ notify: (m) => notices.push(m), changed: () => {} }, "2026-11-04", { ...DEFAULT_SETTINGS, goldCount: 0 });
  return { core, notices };
}

test("shiftDay crosses month and year boundaries", () => {
  assert.equal(shiftDay("2026-11-01", -1), "2026-10-31");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
});

test("finished tasks earn cells that can be painted, and no more", () => {
  const { core, notices } = makeCore();
  core.setContent("- [ ] a #s\n- [ ] b #m", false);
  assert.equal(core.stats().left, 0);
  assert.equal(core.paint(0), false, "nothing earned yet");

  core.setContent("- [x] a #s\n- [ ] b #m", true);
  assert.deepEqual(notices, ["+12 cells to paint"]);
  for (let i = 0; i < 12; i++) assert.equal(core.paint(i), true);
  assert.equal(core.paint(12), false, "out of cells");
  assert.equal(core.paint(3), false, "already painted");
  assert.equal(core.stats().painted, 12);
});

test("unticking after painting leaves you owing cells", () => {
  const { core } = makeCore();
  core.setContent("- [x] a #m", false);
  for (let i = 0; i < 10; i++) core.paint(i);
  core.setContent("- [ ] a #m", false);
  assert.equal(core.stats().left, -10);
});

test("plan coverage notice fires once when the plan reaches the field size", () => {
  const { core, notices } = makeCore();
  core.setContent("- [ ] a [cells:: 100]\n- [ ] b [cells:: 100]", true);
  assert.equal(notices.length, 0);
  core.setContent("- [ ] a [cells:: 100]\n- [ ] b [cells:: 100]\n- [ ] c #l", true);
  assert.deepEqual(notices, ["Your plan now covers the whole field"]);
});

test("streak counts consecutive full days", () => {
  const { core } = makeCore();
  const full = (key: string) => (core.days[key] = { cols: 2, rows: 1, seed: 1, goldCount: 0, goldBonus: 0, painted: [0, 1], earned: 2, planned: 2 });
  full("2026-11-03");
  full("2026-11-02");
  full("2026-10-31"); // gap on Nov 1
  assert.equal(core.streak(), 2);
});

test("old settings keys such as rewards are dropped", () => {
  const s = loadSettings({ cols: 30, milestones: [{ percent: 25, reward: "x" }], smallPrice: "oops" });
  assert.equal(s.cols, 30);
  assert.equal(s.smallPrice, DEFAULT_SETTINGS.smallPrice);
  assert.ok(!("milestones" in s));
});
