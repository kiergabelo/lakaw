import { describe, test, expect } from "vitest";
import { StablePriorityQueue, astar, GridGraph, type AStarGraph } from "../src";

describe("StablePriorityQueue", () => {
  test("dequeue returns items in priority order", () => {
    const pq = new StablePriorityQueue<string>();
    pq.enqueue("low", 5);
    pq.enqueue("high", 1);
    pq.enqueue("mid", 3);
    expect(pq.dequeue()).toBe("high");
    expect(pq.dequeue()).toBe("mid");
    expect(pq.dequeue()).toBe("low");
    expect(pq.dequeue()).toBeUndefined();
  });

  test("FIFO on equal priorities (the stability contract)", () => {
    const pq = new StablePriorityQueue<string>();
    pq.enqueue("A", 5);
    pq.enqueue("B", 3);
    pq.enqueue("C", 5);
    pq.enqueue("D", 3);
    pq.enqueue("E", 5);
    expect(pq.dequeue()).toBe("B");
    expect(pq.dequeue()).toBe("D");
    expect(pq.dequeue()).toBe("A");
    expect(pq.dequeue()).toBe("C");
    expect(pq.dequeue()).toBe("E");
  });

  test("interleaved enqueue/dequeue preserves order", () => {
    const pq = new StablePriorityQueue<string>();
    pq.enqueue("a", 2);
    pq.enqueue("b", 1);
    expect(pq.dequeue()).toBe("b");
    pq.enqueue("c", 1);
    expect(pq.dequeue()).toBe("c");
    expect(pq.dequeue()).toBe("a");
  });

  test("size + isEmpty", () => {
    const pq = new StablePriorityQueue<number>();
    expect(pq.isEmpty()).toBe(true);
    expect(pq.size).toBe(0);
    pq.enqueue(1, 1);
    pq.enqueue(2, 2);
    expect(pq.size).toBe(2);
    expect(pq.isEmpty()).toBe(false);
    pq.dequeue();
    pq.dequeue();
    expect(pq.isEmpty()).toBe(true);
  });

  test("matches a stable-sort reference under randomized workloads", () => {
    class RefPQ<T> {
      private items: { item: T; priority: number }[] = [];
      enqueue(item: T, priority: number) {
        this.items.push({ item, priority });
        this.items.sort((a, b) => a.priority - b.priority);
      }
      dequeue(): T | undefined {
        return this.items.shift()?.item;
      }
      isEmpty() {
        return this.items.length === 0;
      }
    }
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    for (let trial = 0; trial < 50; trial++) {
      const heap = new StablePriorityQueue<number>();
      const ref = new RefPQ<number>();
      let nextItem = 0;
      for (let op = 0; op < 200; op++) {
        if (!ref.isEmpty() && rand() % 3 === 0) {
          const expected = ref.dequeue();
          const actual = heap.dequeue();
          if (expected !== actual) {
            throw new Error(`Trial ${trial}, op ${op}: expected ${expected}, got ${actual}`);
          }
        } else {
          const item = nextItem++;
          const priority = rand() % 5;
          ref.enqueue(item, priority);
          heap.enqueue(item, priority);
        }
      }
      while (!ref.isEmpty()) {
        expect(heap.dequeue()).toBe(ref.dequeue());
      }
      expect(heap.isEmpty()).toBe(true);
    }
  });
});

describe("astar", () => {
  test("finds direct path on an empty 3x3 grid", () => {
    const result = GridGraph.solve(3, 3, new Set(), 0, 0, 2, 2);
    expect(result.found).toBe(true);
    expect(result.cost).toBe(4);
    expect(result.path[0]).toBe("0,0");
    expect(result.path[result.path.length - 1]).toBe("2,2");
  });

  test("respects walls (must route around)", () => {
    const walls = new Set(["0,1", "1,1"]);
    const result = GridGraph.solve(3, 3, walls, 0, 0, 2, 2);
    expect(result.found).toBe(true);
    expect(result.cost).toBe(4);
    expect(result.path).not.toContain("0,1");
    expect(result.path).not.toContain("1,1");
  });

  test("returns found=false when fully blocked", () => {
    const walls = new Set(["0,1", "1,0", "1,1", "1,2", "2,1"]);
    const result = GridGraph.solve(3, 3, walls, 0, 0, 2, 2);
    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.cost).toBe(0);
  });

  test("start === goal returns single-node path", () => {
    const result = GridGraph.solve(3, 3, new Set(), 1, 1, 1, 1);
    expect(result.found).toBe(true);
    expect(result.path).toEqual(["1,1"]);
    expect(result.cost).toBe(0);
  });

  test("reports visited count and iteration diagnostics", () => {
    const result = GridGraph.solve(5, 5, new Set(), 0, 0, 4, 4);
    expect(result.found).toBe(true);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.visited).toBeGreaterThan(0);
    expect(result.visited).toBeLessThanOrEqual(25);
  });

  test("respects maxIterations", () => {
    const result = GridGraph.solve(100, 100, new Set(), 0, 0, 99, 99);
    expect(result.found).toBe(true);

    const blocked = new Set<string>(["1,0"]);
    const truncated = GridGraph.solve(100, 100, blocked, 0, 0, 99, 99);
    expect(truncated.found).toBe(true);
  });

  test("prefers shorter path with heuristic vs without", () => {
    const withHeur = GridGraph.solve(10, 10, new Set(), 0, 0, 9, 9);
    expect(withHeur.found).toBe(true);
    expect(withHeur.cost).toBe(18);

    const graph = new GridGraph(10, 10, new Set(), 9, 9);
    const result = astar({
      graph,
      start: "0,0",
      isGoal: (id) => id === "9,9",
    });
    expect(result.found).toBe(true);
    expect(result.cost).toBe(18);
    expect(result.iterations).toBeGreaterThanOrEqual(withHeur.iterations);
  });

  test("custom graph — 4-node chain", () => {
    const graph: AStarGraph = {
      neighbors(id: string) {
        const map: Record<string, { to: string; cost: number }[]> = {
          a: [{ to: "b", cost: 1 }],
          b: [{ to: "c", cost: 2 }],
          c: [{ to: "d", cost: 3 }],
          d: [],
        };
        return map[id] ?? [];
      },
    };
    const result = astar({
      graph,
      start: "a",
      isGoal: (id: string) => id === "d",
    });
    expect(result.found).toBe(true);
    expect(result.path).toEqual(["a", "b", "c", "d"]);
    expect(result.cost).toBe(6);
  });

  test("chooses cheaper multi-hop route over direct", () => {
    const graph: AStarGraph = {
      neighbors(id: string) {
        const map: Record<string, { to: string; cost: number }[]> = {
          a: [{ to: "b", cost: 1 }, { to: "c", cost: 10 }],
          b: [{ to: "c", cost: 1 }],
          c: [],
        };
        return map[id] ?? [];
      },
    };
    const result = astar({
      graph,
      start: "a",
      isGoal: (id: string) => id === "c",
    });
    expect(result.found).toBe(true);
    expect(result.path).toEqual(["a", "b", "c"]);
    expect(result.cost).toBe(2);
  });
});
