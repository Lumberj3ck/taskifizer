# Taskifizer

An Obsidian plugin that turns finished tasks into a small daily painting.

Every task in today's daily note has a price in cells. Each day has a field of a fixed size
(20 × 12 = 240 cells by default). Finish a task and you earn its cells; then you paint them onto
the field yourself, one click or one drag at a time, and each painted cell uncovers part of the
day's hidden pixel picture. If your tasks don't add up to the field size, you can't finish the
picture until you plan more.

## Pricing tasks

```markdown
- [ ] Inbox zero #s              12 cells
- [ ] Write tests for parser #m  24 cells
- [ ] Draft blog post #l         48 cells
- [ ] Do the tax return [cells:: 70]
- [ ] Call the bank              untagged: 12 cells (configurable)
- [-] Cancelled task #l          doesn't count
```

Tags, prices, the untagged price and a cap on custom prices are all in settings.

## The sidebar

- **Header**: today's date and your streak of fully painted days.
- **Field**: click or drag to paint. Golden cells give bonus cells when painted.
- **Painted / to paint**: cells on the field, and earned cells you haven't placed yet. Unticking a task after painting its cells leaves you owing them.
- **Plan meter**: one bar for the day's budget: painted, ready to paint, still in unfinished tasks, and not covered by any task.
- **Week**: the last seven pictures, dimmed until they're complete.

The status bar shows `painted/total · N to paint`. Click it to open the field.

## Daily notes

Taskifizer reads the folder and file name format from the core Daily notes plugin. You can override
both in settings. The command **Open today's daily note** (and the button in the sidebar) creates the
note through the core plugin, so your template is applied.

## Development

```sh
npm install
npm run dev      # watch build to main.js
npm run build    # typecheck + production build
npm test         # parser, picture generator and core rules
npm run preview  # dist/preview.html: the real view running in a mock Obsidian window
```

To try it in a vault, link this folder into the vault's plugins directory and enable
**Taskifizer** under Settings → Community plugins:

```sh
ln -s "$PWD" /path/to/vault/.obsidian/plugins/taskifizer
```

## Data

Settings and each day's painted cells are stored in the plugin's `data.json`. A day keeps the field
size and golden cell settings it started with, so changing them takes effect the next day
(or after **Reset today's field**).
