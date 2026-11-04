# Working on LearningAI

## Content
- Course structure lives in `src/content/manifest.json`: chapters, topics, quizzes, and each topic's `figures`, `interactive` and `tags`. If you add a figure or widget to a topic, update its counts there.
- A topic body is an HTML fragment at `src/content/pages/<chapter>/<topic-id>.html`. It uses the content design system in `src/styles/content.css`:
  - `figure.fig`, `.box.example|pit|lab`, `.terms`, `.ff` (In practice / Failure to avoid), `.tools`, `.flow` steppers
  - evidence tags: `.tag cpu|real|sim|gpu`
- Write cross-links as `<a href="#c9-3">` or `<a href="#someElementId">`. `HtmlContent` resolves them through `src/content/idmap.json`. Add new link targets to that file.
- `scripts/import_legacy.py` was a one-time import from the v3 single file. Do not re-run it over edited content.
- Keep the course's standards:
  - Label simulations as simulations, and give illustrative numbers as illustrative.
  - Link to official documentation.
  - Say what a lab result does and does not prove.

## Widgets
- New widgets are React components in `src/widgets/<name>/`. Register each one in `src/widgets/registry.ts`, lazily so each gets its own code chunk.
- Embed a widget in content with `<div data-widget="name" data-props='{"k":1}'></div>`.
- Each widget should:
  - read colours from the CSS tokens (`--accent`, `--sim`, `--signal`, `--ok`, `--bad`, `--ink`, `--muted`, `--surface`, `--sunk`, `--rule`)
  - redraw when `useTheme().version` changes
  - respect reduced motion
- 3D (three.js / @react-three/fiber):
  - Mount only near the viewport.
  - Use `frameloop="demand"` unless animating.
  - Provide a fallback when WebGL is missing and a text description.
  - Use 3D only when the third axis carries data.
- The v3 vanilla widgets live in `src/legacy/widgets.js`. Each block is guarded by an element id, and `src/legacy/runtime.ts` cancels its timers and animation frames on unmount. When you rebuild a widget in React, delete its block there.
- Do not add Tailwind or another utility framework without a prefix. The legacy SVG and figure classes (`grid`, `row`, `fill`, `box`, `fig`, `out`, …) would clash with it.

## Checks before committing
```bash
npm run typecheck
npm run build
```

```bash
npx vite preview --port 4173 &
npm run test:e2e   # must print ALL CHECKS PASSED
```
