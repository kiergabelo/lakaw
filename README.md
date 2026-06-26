# Lakaw — Dependency-Free A* Pathfinding

A tiny TypeScript A* search library with a stable min-priority queue.

**Cebuano:** *lakaw* = walk / go.

Extracted and generalized from the transit routing engine that powers
[Amping](https://amping.app) — a Cebuano transit PWA. The `StablePriorityQueue`
ships verbatim from production (with its parity tests); the A* loop is the same
shape, de-coupled from transit-domain concepts. Zero runtime dependencies — one
file, ~150 LOC.

## Features

- Generic A* search with an optional heuristic (defaults to 0 → Dijkstra).
- `StablePriorityQueue` — a binary min-heap with a sequence-number tiebreaker so
  ties are dequeued in insertion order. A* explores deterministically; route
  suggestions don't drift on equal-cost paths.
- `GridGraph` helper for 4-connected 2D grids, with Manhattan-distance built in.
- 14 Vitest tests, including a randomized parity proof against a stable-sort
  reference queue (50 trials × 200 mixed ops — identical output every time).
- `onVisit` + `onEnqueue` callbacks for visualization hooks.
- Side-by-side **A* vs Dijkstra** demo with:
  - g-score heat map (cool→warm gradient by cumulative cost)
  - open-set (frontier) visualization
  - animated visit sequence with recency color grading
  - animated path tracing
  - 6 preset maze layouts (empty, random, corridors, spiral, rooms,
    recursive division)
  - speed control + step mode
  - efficiency comparison banner (visited count + iterations)
  - keyboard shortcuts
  - JSON stats export
  - collapsible info panel explaining the algorithm

## Stack

- TypeScript 6, compiled in `strict` mode
- Vite 8 for the demo
- Vitest 4 for tests
- tsup 8 for the library build
- **Zero runtime dependencies**
- 4.5 KB ESM / 5.6 KB CJS, types included

## Quick start

```bash
npm install

npm run dev          # serve the demo locally
npm test             # run the 14 tests
npm run build        # build the library (dist/)
npm run build:demo   # build the demo (demo/dist/)
```

To preview the built demo:

```bash
npm run build:demo
npx vite preview     # serves demo/dist at localhost:4173
```

## Deploy

The demo is a static site deployed on **Cloudflare Pages**.

- **Build command:** `npm run build:demo`
- **Build output directory:** `demo/dist`
- **Domain:** `lakaw.kierabelo.com`

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `S` | Step one frame |
| `R` | Reset |
| `M` | Random maze |
| `C` | Clear walls (empty) |
| `H` | Toggle heat map |
| `F` | Toggle frontier |
| `1`–`6` | Preset layouts (empty, random, corridors, spiral, rooms, recursive division) |

## Project structure

```
lakaw/
├── src/
│   ├── astar.ts            # The A* algorithm + types
│   ├── priorityQueue.ts    # StablePriorityQueue (binary heap + FIFO ties)
│   ├── grid.ts             # GridGraph helper for 2D grids
│   └── index.ts            # Public exports
├── tests/
│   └── astar.test.ts       # 14 tests across astar + priority queue
├── demo/
│   ├── index.html          # Single-page A* vs Dijkstra demo
│   └── main.ts             # Vite + SVG visualization
├── package.json
├── tsconfig.json
├── tsconfig.build.json     # declaration emit
├── vitest.config.ts
└── vite.config.ts          # demo build → demo/dist
```

## License

MIT. The `StablePriorityQueue` ships with parity tests from Amping's transit
router (also MIT).

## Origin

Generalized from the routing engine at
[`kiergabelo/amping-dev`](https://github.com/kiergabelo/amping-dev)
(`src/lib/transit/`) which powers real Cebuano transit suggestions on
[amping.app](https://amping.app). The priority queue + tests are lifted
verbatim; the A* loop is the same shape, stripped of transit-domain concepts
(fares, jeepney routes, supernode POIs).
