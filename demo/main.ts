import { astar, type AStarGraph } from "../src";

const ROWS = 22;
const COLS = 38;
const CELL = 18;
const CELL_PAD = 1;

let walls = new Set<string>();
let start = { r: 4, c: 4 };
let goal = { r: 17, c: 32 };
let mode: "wall" | "start" | "goal" = "wall";
let isDragging = false;

interface Visit { nodeId: string; step: number; gScore: number; }
interface RunResult {
  visits: Visit[];
  path: string[];
  cost: number;
  iterations: number;
  visited: number;
  found: boolean;
}

const svgA = document.getElementById("grid-astar") as SVGElement;
const svgD = document.getElementById("grid-dijkstra") as SVGElement;
const runBtn = document.getElementById("run") as HTMLButtonElement;
const stepBtn = document.getElementById("step") as HTMLButtonElement;
const resetBtn = document.getElementById("reset") as HTMLButtonElement;
const clearBtn = document.getElementById("clear") as HTMLButtonElement;
const mazeBtn = document.getElementById("maze") as HTMLButtonElement;
const speedInput = document.getElementById("speed") as HTMLInputElement;
const speedLabel = document.getElementById("speed-label")!;

svgA.setAttribute("viewBox", `0 0 ${COLS * CELL} ${ROWS * CELL}`);
svgD.setAttribute("viewBox", `0 0 ${COLS * CELL} ${ROWS * CELL}`);

function key(r: number, c: number): string { return `${r},${c}`; }

function neighbors(r: number, c: number): { to: string; cost: number }[] {
  const out: { to: string; cost: number }[] = [];
  const deltas: ReadonlyArray<readonly [number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of deltas) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
    const k = key(nr, nc);
    if (walls.has(k)) continue;
    out.push({ to: k, cost: 1 });
  }
  return out;
}

function buildGraph(): AStarGraph {
  return {
    neighbors(nodeId: string) {
      const [r, c] = nodeId.split(",").map(Number);
      return neighbors(r!, c!);
    },
  };
}

function manhattan(id: string): number {
  const [r, c] = id.split(",").map(Number);
  return Math.abs(r! - goal.r) + Math.abs(c! - goal.c);
}

function runAlgorithm(useHeuristic: boolean): RunResult {
  const visits: Visit[] = [];
  const graph = buildGraph();
  const startId = key(start.r, start.c);
  const goalId = key(goal.r, goal.c);
  const result = astar({
    graph,
    start: startId,
    isGoal: (id) => id === goalId,
    heuristic: useHeuristic ? manhattan : undefined,
    onVisit: (nodeId, step, gScore) => {
      visits.push({ nodeId, step, gScore });
    },
  });
  return {
    visits,
    path: result.path,
    cost: result.cost,
    iterations: result.iterations,
    visited: result.visited,
    found: result.found,
  };
}

let animState: {
  astarRun: RunResult;
  dijkstraRun: RunResult;
  step: number;
  playing: boolean;
  done: boolean;
  pathStep: number;
} | null = null;

let speed = parseInt(speedInput.value, 10);
let lastTickTime = 0;
let rafId = 0;

function render(svg: SVGElement, visits: Visit[], path: string[], visitColor: string, frameStep: number, pathStep: number) {
  const visitMap = new Map<string, number>();
  const maxStep = Math.max(frameStep, 1);
  for (const v of visits.slice(0, frameStep)) visitMap.set(v.nodeId, v.step);
  const pathSet = new Set(path.slice(0, pathStep));

  const cells: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = key(r, c);
      const x = c * CELL + CELL_PAD;
      const y = r * CELL + CELL_PAD;
      const sz = CELL - 2 * CELL_PAD;
      let fill = "transparent";
      let stroke = "var(--line)";
      let sw = "0.5";

      if (r === start.r && c === start.c) {
        fill = "var(--accent)";
      } else if (r === goal.r && c === goal.c) {
        fill = "var(--warm)";
      } else if (walls.has(k)) {
        fill = "var(--line)";
        stroke = "transparent";
      } else if (pathSet.has(k)) {
        fill = "var(--path)";
      } else if (visitMap.has(k)) {
        // Recency fade — more recent visits are more saturated.
        const v = visitMap.get(k)!;
        const fade = 1 - (v / maxStep) * 0.6;
        fill = visitColor;
        sw = "0";
        cells.push(`<rect x="${x}" y="${y}" width="${sz}" height="${sz}" rx="2.5" fill="${fill}" opacity="${fade * 0.5}" />`);
        continue;
      }
      cells.push(`<rect x="${x}" y="${y}" width="${sz}" height="${sz}" rx="2.5" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" data-k="${k}" />`);
    }
  }
  svg.innerHTML = cells.join("");
}

function tick(now: number) {
  if (!animState || !animState.playing) { rafId = 0; return; }
  const dt = (now - lastTickTime) / 1000;
  lastTickTime = now;
  const stepRate = speed;
  const totalVisits = Math.max(animState.astarRun.visits.length, animState.dijkstraRun.visits.length);
  animState.step = Math.min(totalVisits, animState.step + stepRate * dt);
  const visitsDone = animState.step >= totalVisits;
  if (visitsDone && animState.pathStep < Math.max(animState.astarRun.path.length, animState.dijkstraRun.path.length)) {
    animState.pathStep = Math.min(
      Math.max(animState.astarRun.path.length, animState.dijkstraRun.path.length),
      animState.pathStep + stepRate * 0.5 * dt
    );
  }
  if (visitsDone && animState.pathStep >= Math.max(animState.astarRun.path.length, animState.dijkstraRun.path.length)) {
    animState.playing = false;
    animState.done = true;
    runBtn.textContent = "▶ Run";
  }
  updateUI();
  rafId = requestAnimationFrame(tick);
}

function updateUI() {
  if (!animState) return;
  const s = animState;
  const visitsToShowA = Math.min(s.astarRun.visits.length, Math.floor(s.step));
  const visitsToShowD = Math.min(s.dijkstraRun.visits.length, Math.floor(s.step));
  const pathToShowA = Math.min(s.astarRun.path.length, Math.floor(s.pathStep));
  const pathToShowD = Math.min(s.dijkstraRun.path.length, Math.floor(s.pathStep));

  render(svgA, s.astarRun.visits, s.astarRun.path, "var(--astar)", visitsToShowA, pathToShowA);
  render(svgD, s.dijkstraRun.visits, s.dijkstraRun.path, "var(--dijkstra)", visitsToShowD, pathToShowD);

  (document.getElementById("astar-visited")!).textContent = String(visitsToShowA);
  (document.getElementById("astar-path")!).textContent = s.astarRun.found ? String(s.astarRun.path.length) : "—";
  (document.getElementById("astar-cost")!).textContent = s.astarRun.found ? String(s.astarRun.cost) : "—";
  (document.getElementById("astar-iter")!).textContent = s.astarRun.iterations;

  (document.getElementById("dik-visited")!).textContent = String(visitsToShowD);
  (document.getElementById("dik-path")!).textContent = s.dijkstraRun.found ? String(s.dijkstraRun.path.length) : "—";
  (document.getElementById("dik-cost")!).textContent = s.dijkstraRun.found ? String(s.dijkstraRun.cost) : "—";
  (document.getElementById("dik-iter")!).textContent = s.dijkstraRun.iterations;

  const totalVisitMax = Math.max(s.astarRun.visits.length, s.dijkstraRun.visits.length, 1);
  (document.getElementById("prog-astar") as HTMLElement).style.width = `${(visitsToShowA / totalVisitMax) * 100}%`;
  (document.getElementById("prog-dijkstra") as HTMLElement).style.width = `${(visitsToShowD / totalVisitMax) * 100}%`;
}

function startRun() {
  const astarResult = runAlgorithm(true);
  const dijkstraResult = runAlgorithm(false);
  animState = {
    astarRun: astarResult,
    dijkstraRun: dijkstraResult,
    step: 0,
    pathStep: 0,
    playing: true,
    done: false,
  };
  lastTickTime = performance.now();
  runBtn.textContent = "⏸ Pause";
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
  console.log("[Lakaw] A*:", { visited: astarResult.visited, iter: astarResult.iterations, cost: astarResult.cost });
  console.log("[Lakaw] Dijkstra:", { visited: dijkstraResult.visited, iter: dijkstraResult.iterations, cost: dijkstraResult.cost });
}

function togglePlay() {
  if (!animState) { startRun(); return; }
  if (animState.done) {
    animState.step = 0;
    animState.pathStep = 0;
    animState.done = false;
    animState.playing = true;
    runBtn.textContent = "⏸ Pause";
    lastTickTime = performance.now();
    rafId = requestAnimationFrame(tick);
    return;
  }
  animState.playing = !animState.playing;
  runBtn.textContent = animState.playing ? "⏸ Pause" : "▶ Run";
  if (animState.playing) {
    lastTickTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }
}

function stepOnce() {
  if (!animState) { startRun(); }
  if (!animState) return;
  animState.playing = false;
  runBtn.textContent = "▶ Run";
  const totalVisits = Math.max(animState.astarRun.visits.length, animState.dijkstraRun.visits.length);
  if (animState.step < totalVisits) {
    animState.step = Math.min(totalVisits, animState.step + 1);
  } else {
    const maxPath = Math.max(animState.astarRun.path.length, animState.dijkstraRun.path.length);
    animState.pathStep = Math.min(maxPath, animState.pathStep + 1);
  }
  updateUI();
}

function reset() {
  animState = null;
  runBtn.textContent = "▶ Run";
  cancelAnimationFrame(rafId);
  document.getElementById("astar-visited")!.textContent = "0";
  document.getElementById("astar-path")!.textContent = "—";
  document.getElementById("astar-cost")!.textContent = "—";
  document.getElementById("astar-iter")!.textContent = "—";
  document.getElementById("dik-visited")!.textContent = "0";
  document.getElementById("dik-path")!.textContent = "—";
  document.getElementById("dik-cost")!.textContent = "—";
  document.getElementById("dik-iter")!.textContent = "—";
  (document.getElementById("prog-astar") as HTMLElement).style.width = "0%";
  (document.getElementById("prog-dijkstra") as HTMLElement).style.width = "0%";
  // Static render — show grid only
  render(svgA, [], [], "var(--astar)", 0, 0);
  render(svgD, [], [], "var(--dijkstra)", 0, 0);
}

function cellFromEvent(svg: SVGElement, e: MouseEvent): { r: number; c: number } | null {
  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const sx = (COLS * CELL) / rect.width;
  const sy = (ROWS * CELL) / rect.height;
  const c = Math.floor(x * sx / CELL);
  const r = Math.floor(y * sy / CELL);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  return { r, c };
}

function paint(r: number, c: number) {
  const k = key(r, c);
  if (mode === "wall") {
    if (r === start.r && c === start.c) return;
    if (r === goal.r && c === goal.c) return;
    if (walls.has(k)) walls.delete(k); else walls.add(k);
  } else if (mode === "start") {
    if (walls.has(k)) return;
    start = { r, c };
  } else {
    if (walls.has(k)) return;
    goal = { r, c };
  }
  animState = null;
  runBtn.textContent = "▶ Run";
  cancelAnimationFrame(rafId);
  render(svgA, [], [], "var(--astar)", 0, 0);
  render(svgD, [], [], "var(--dijkstra)", 0, 0);
}

// Attach mouse handlers to both grids.
for (const svg of [svgA, svgD]) {
  svg.addEventListener("mousedown", (e) => {
    isDragging = true;
    const cell = cellFromEvent(svg, e);
    if (cell) paint(cell.r, cell.c);
  });
  svg.addEventListener("mousemove", (e) => {
    if (!isDragging || (mode !== "wall")) return;
    const cell = cellFromEvent(svg, e);
    if (cell && !(cell.r === start.r && cell.c === start.c) && !(cell.r === goal.r && cell.c === goal.c)) {
      const k = key(cell.r, cell.c);
      if (!walls.has(k)) walls.add(k);
      animState = null;
      runBtn.textContent = "▶ Run";
      cancelAnimationFrame(rafId);
      render(svgA, [], [], "var(--astar)", 0, 0);
      render(svgD, [], [], "var(--dijkstra)", 0, 0);
    }
  });
  svg.addEventListener("mouseup", () => { isDragging = false; });
  svg.addEventListener("mouseleave", () => { isDragging = false; });
}

document.querySelectorAll(".mode-selector button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-selector button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    mode = (btn as HTMLElement).dataset["mode"] as any;
  });
});

runBtn.addEventListener("click", togglePlay);
stepBtn.addEventListener("click", stepOnce);
resetBtn.addEventListener("click", reset);
clearBtn.addEventListener("click", () => {
  walls = new Set();
  reset();
});
mazeBtn.addEventListener("click", () => {
  walls = new Set();
  // Generate a denser random maze so Dijkstra/A* differences are highly visible.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === start.r && c === start.c) continue;
      if (r === goal.r && c === goal.c) continue;
      if (Math.random() < 0.32) walls.add(key(r, c));
    }
  }
  reset();
});

speedInput.addEventListener("input", () => {
  speed = parseInt(speedInput.value, 10);
  speedLabel.textContent = `${speed} cells/s`;
});

// Initial maze generation for a good first impression.
(function initialLayout() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === start.r && c === start.c) continue;
      if (r === goal.r && c === goal.c) continue;
      if (Math.random() < 0.28) walls.add(key(r, c));
    }
  }
})();

render(svgA, [], [], "var(--astar)", 0, 0);
render(svgD, [], [], "var(--dijkstra)", 0, 0);
