import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTasks, priceOf, totals, type PriceSettings } from "../src/tasks";
import { makeScene, hashString } from "../src/scene";

const S: PriceSettings = {
  smallTag: "s",
  mediumTag: "m",
  largeTag: "l",
  smallPrice: 12,
  mediumPrice: 24,
  largePrice: 48,
  defaultPrice: 12,
  maxCustomPrice: 100,
};

test("prices come from size tags, custom fields and the default", () => {
  assert.equal(priceOf("Inbox zero #s", S), 12);
  assert.equal(priceOf("Write tests #m", S), 24);
  assert.equal(priceOf("Draft outline #l", S), 48);
  assert.equal(priceOf("Call the bank", S), 12);
  assert.equal(priceOf("Tax return [cells:: 70]", S), 70);
  assert.equal(priceOf("Tax return (cells:: 70) #s", S), 70, "custom price wins over a tag");
  assert.equal(priceOf("Drink water [cells:: 240]", S), 100, "custom price is capped");
  assert.equal(priceOf("No cap [cells:: 240]", { ...S, maxCustomPrice: 0 }), 240);
});

test("size tags need to be whole tags", () => {
  assert.equal(priceOf("Read #lisp book", S), 12, "#lisp is not #l");
  assert.equal(priceOf("Gym #L", S), 48, "tags are case-insensitive");
  assert.equal(priceOf("Plan (#m)", S), 12, "a tag must start after whitespace");
  assert.equal(priceOf("Big one #l, then rest", S), 48);
});

test("parses task lines and their status", () => {
  const note = [
    "---",
    "tags: daily",
    "- [x] not a task, frontmatter",
    "---",
    "## Today",
    "- [x] Morning run #m",
    "- [ ] Write tests #m",
    "* [X] Reply to PR #s",
    "1. [ ] Draft outline #l",
    "- [-] Cancelled thing #l",
    "  - [/] In progress subtask",
    "> - [ ] Task in a callout #s",
    "- [ ] ",
    "- plain bullet",
    "```",
    "- [ ] task inside code",
    "```",
  ].join("\n");

  const tasks = parseTasks(note, S);
  assert.deepEqual(
    tasks.map((t) => [t.status, t.price]),
    [
      ["done", 24],
      ["open", 24],
      ["done", 12],
      ["open", 48],
      ["cancelled", 48],
      ["open", 12],
      ["open", 12],
    ],
  );
  assert.equal(tasks[0].line, 5);

  const t = totals(tasks);
  assert.equal(t.done, 36);
  assert.equal(t.planned, 24 + 24 + 12 + 48 + 12 + 12, "cancelled tasks are not planned");
  assert.equal(t.doneCount, 2);
  assert.equal(t.openCount, 4);
});

test("scenes are deterministic and sized to the field", () => {
  const seed = hashString("2026-11-04");
  const a = makeScene(seed, 20, 12, 4);
  const b = makeScene(seed, 20, 12, 4);
  assert.deepEqual(a, b);
  assert.equal(a.colors.length, 240);
  assert.ok(a.colors.every((c) => /^#[0-9a-f]{6}$/.test(c)));
  assert.equal(new Set(a.gold).size, 4);
  assert.ok(a.gold.every((i) => i >= 0 && i < 240));

  const big = makeScene(seed, 32, 18, 6);
  assert.equal(big.colors.length, 32 * 18);
  assert.notDeepEqual(makeScene(hashString("2026-11-05"), 20, 12, 4).colors, a.colors);
});
