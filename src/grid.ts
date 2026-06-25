import { astar, type AStarGraph, type AStarResult } from "./astar";

/**
 * GridGraph — a 2D grid for the classic A* demo. Walls block movement,
 * 4-way adjacency (no diagonals) with cost 1 per step. Manhattan distance
 * is the admissible heuristic.
 */
export class GridGraph implements AStarGraph {
  readonly rows: number;
  readonly cols: number;
  private walls: Set<string>;
  private goalR: number;
  private goalC: number;

  constructor(rows: number, cols: number, walls: Set<string>, goalR: number, goalC: number) {
    this.rows = rows;
    this.cols = cols;
    this.walls = walls;
    this.goalR = goalR;
    this.goalC = goalC;
  }

  private key(r: number, c: number): string {
    return `${r},${c}`;
  }

  neighbors(nodeId: string): Iterable<{ to: string; cost: number }> {
    const [r, c] = nodeId.split(",").map(Number);
    const out: { to: string; cost: number }[] = [];
    const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
    for (const [dr, dc] of deltas) {
      const nr = r! + dr;
      const nc = c! + dc;
      if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
      const k = this.key(nr, nc);
      if (this.walls.has(k)) continue;
      out.push({ to: k, cost: 1 });
    }
    return out;
  }

  heuristic(nodeId: string): number {
    const [r, c] = nodeId.split(",").map(Number);
    return Math.abs(r! - this.goalR) + Math.abs(c! - this.goalC);
  }

  static solve(
    rows: number,
    cols: number,
    walls: Set<string>,
    startR: number,
    startC: number,
    goalR: number,
    goalC: number,
  ): AStarResult {
    const graph = new GridGraph(rows, cols, walls, goalR, goalC);
    const start = `${startR},${startC}`;
    const goalKey = `${goalR},${goalC}`;
    return astar({
      graph,
      start,
      isGoal: (id) => id === goalKey,
      heuristic: (id) => graph.heuristic(id),
    });
  }
}
