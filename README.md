# Lakaw — Dependency-Free A* Pathfinding

Tiny TypeScript A* search library with a stable min-priority queue.

**Cebuano:** *lakaw* = walk / go.

Extracted and generalized from the transit routing engine that powers
[Amping](https://amping.app) — a Cebuano transit PWA. The priority queue
ships verbatim from production (with its parity tests), and the A* loop is
the same shape, just de-coupled from transit-domain concepts.

## Why use it

- **Zero dependencies.** No `heap-js`, no `fastPriorityQueue`. One file, ~150 LOC.
- **Stable on ties.** The binary heap uses a sequence-number tiebreaker so
  ties are dequeued in insertion order — meaning A* explores deterministically.
  Most priority queues don't do this, and route suggestions drift as a result.
- **Generic.** Implement the 1-method `AStarGraph` interface (return neighbors
  of a node ID); the library handles the rest.
- **Bundled small.** ~4.5 KB ESM / ~5.6 KB CJS, types included.
- **Tested.** 14 tests, including a randomized parity proof against a stable-sort
  reference queue.

## Install

```bash
npm install lakaw
```

## Usage

```typescript
import { astar, type AStarGraph } from "lakaw";

// Implement the 1-method graph interface for your domain
const graph: AStarGraph = {
  neighbors(id: string) {
    const edges: Record<string, { to: string; cost: number }[]> = {
      a: [{ to: "b", cost: 1 }, { to: "c", cost: 10 }],
      b: [{ to: "c", cost: 1 }],
      c: [],
    };
    return edges[id] ?? [];
  },
};

const result = astar({
  graph,
  start: "a",
  isGoal: (id) => id === "c",
  // Optional — defaults to 0 (=> Dijkstra). Must be admissible.
  heuristic: (id) => (id === "b" ? 1 : 0),
});

// → { found: true, path: ["a", "b", "c"], cost: 2, iterations: 3, visited: 3 }
```

### Grid helper

For 2D grids (game maps, maze solvers), use `GridGraph`:

```typescript
import { GridGraph } from "lakaw";

const walls = new Set(["1,1", "0,1"]);
const result = GridGraph.solve(5, 5, walls, 0, 0, 4, 4);
// → { found: true, path: [...], cost: 8 }
```

Manhattan-distance heuristic is built in.

## API

### `astar(options: AStarOptions): AStarResult`

| Option | Type | Required | Description |
|---|---|---|---|
| `graph` | `AStarGraph` | yes | Object with a `neighbors(id)` method returning `{ to, cost }[]` |
| `start` | `string` | yes | Starting node ID |
| `isGoal` | `(id) => boolean` | yes | Predicate for the goal |
| `heuristic` | `(from) => number` | no | Admissible estimate to the goal (default 0 → Dijkstra) |
| `maxIterations` | `number` | no | Safety cap (default 100,000) |

Returns `{ path, cost, iterations, visited, found }`.

### `StablePriorityQueue<T>`

The underlying binary min-heap with FIFO tie-breaking. Standalone — use it
for any priority-queue need.

### `GridGraph`

A `AStarGraph` implementation for 4-connected 2D grids. `GridGraph.solve(...)`
returns an `AStarResult`.

## Live demo

The `demo/` folder contains an interactive grid visualization. Add walls,
move start/goal, run A*, see the cost + visited count.

Build + open locally:

```bash
cd lakaw
npm install
npm run build:demo    # outputs to demo/dist/
npx vite preview     # serves at localhost:4173
```

Or visit the deployed demo at `lakaw.kierabelo.com` (Cloudflare Pages).

## Benchmarks

Tested against a randomized stable-sort reference queue across 50 trials of
200 mixed enqueue/dequeue operations each — identical output. (See
`tests/astar.test.ts`.)

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
│   ├── index.html          # Single-page grid demo
│   └── main.ts             # Vite + SVG visualization
├── package.json
├── tsconfig.json
├── tsconfig.build.json     # declaration emit
├── vitest.config.ts
└── vite.config.ts          # demo build
```

## License

MIT. The `StablePriorityQueue` ships with parity tests from Amping's transit
router (also MIT-weighted; contact for licensing questions).

## Origin

Generalized from the routing engine at [`amping-dev/src/lib/transit/`](https://github.com/kiergabelo/amping-dev)
which powers real Cebuano transit suggestions on [amping.app](https://amping.app).
The priority queue + tests are lifted verbatim; the A* loop is the same shape,
stripped of transit-domain concepts (fares, jeepney routes, supernode POIs).
