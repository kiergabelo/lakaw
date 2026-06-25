import { StablePriorityQueue } from "./priorityQueue";

export { StablePriorityQueue };

/**
 * A directed edge in a graph. `cost` must be non-negative for A* admissibility.
 */
export interface AStarEdge {
  to: string;
  cost: number;
}

/**
 * Minimal graph interface — implement this for your domain.
 * Return the out-edges of `nodeId`. Edges to non-existent nodes are ignored.
 */
export interface AStarGraph {
  neighbors(nodeId: string): Iterable<AStarEdge>;
}

export interface AStarOptions {
  graph: AStarGraph;
  start: string;
  /** Returns true when the goal is reached. */
  isGoal: (nodeId: string) => boolean;
  /**
   * Admissible heuristic estimate from `from` to the nearest goal.
   * Defaults to 0 (=> Dijkstra). Must never over-estimate.
   */
  heuristic?: (from: string) => number;
  /** Safety valve. Default 100_000. */
  maxIterations?: number;
}

export interface AStarResult {
  /** Node IDs from start to goal, inclusive. Empty if not found. */
  path: string[];
  /** Cost of the discovered path. 0 if not found. */
  cost: number;
  /** Total open-set pops performed. */
  iterations: number;
  /** Distinct nodes ever added to the closed set. */
  visited: number;
  found: boolean;
}

/**
 * A* search over a generic string-ID graph.
 *
 * - Stable on ties (via StablePriorityQueue) so results are deterministic.
 * - Returns the full path + cost + diagnostic counts.
 * - Closes nodes on first pop (no re-opening) — admissible-heuristic safe.
 * - Good for routing, grid pathfinding, puzzle solvers, game AI.
 */
export function astar(opts: AStarOptions): AStarResult {
  const { graph, start, isGoal, heuristic } = opts;
  const maxIter = opts.maxIterations ?? 100_000;

  const open = new StablePriorityQueue<string>();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, { from: string; edgeCost: number }>();
  const closed = new Set<string>();

  gScore.set(start, 0);
  open.enqueue(start, (heuristic?.(start) ?? 0));

  let iterations = 0;
  let visitedCount = 0;

  while (!open.isEmpty()) {
    if (iterations++ >= maxIter) {
      return { path: [], cost: 0, iterations, visited: visitedCount, found: false };
    }
    const current = open.dequeue()!;
    if (closed.has(current)) continue;
    closed.add(current);
    visitedCount++;

    if (isGoal(current)) {
      const path = reconstructPath(cameFrom, current);
      return { path, cost: gScore.get(current) ?? 0, iterations, visited: visitedCount, found: true };
    }

    const currentG = gScore.get(current) ?? Infinity;
    for (const edge of graph.neighbors(current)) {
      if (closed.has(edge.to)) continue;
      const tentativeG = currentG + edge.cost;
      const known = gScore.get(edge.to) ?? Infinity;
      if (tentativeG < known) {
        cameFrom.set(edge.to, { from: current, edgeCost: edge.cost });
        gScore.set(edge.to, tentativeG);
        open.enqueue(edge.to, tentativeG + (heuristic?.(edge.to) ?? 0));
      }
    }
  }

  return { path: [], cost: 0, iterations, visited: visitedCount, found: false };
}

function reconstructPath(
  cameFrom: Map<string, { from: string; edgeCost: number }>,
  end: string,
): string[] {
  const path = [end];
  let cur = end;
  while (cameFrom.has(cur)) {
    cur = cameFrom.get(cur)!.from;
    path.unshift(cur);
  }
  return path;
}
