import { astar, type AStarGraph } from "../src";

const ROWS = 22;
const COLS = 38;
const CELL = 18;
const CELL_PAD = 1;
const NS = "http://www.w3.org/2000/svg";

// Concrete palette used for SVG fills (transitions interpolate resolved colors).
const C = {
  accent: "#34d399",
  warm: "#fbbf24",
  path: "#4ade80",
  astar: "#38bdf8",
  dijkstra: "#fb7185",
  wall: "#1b1f29",
};

const PRESETS = ["empty", "random", "corridors", "spiral", "rooms", "recursive"] as const;
type PresetId = (typeof PRESETS)[number];

interface Visit { nodeId: string; step: number; gScore: number; }
interface Enqueue { nodeId: string; fScore: number; visitIdx: number; }
interface RunResult {
  visits: Visit[];
  enqueues: Enqueue[];
  path: string[];
  cost: number;
  iterations: number;
  visited: number;
  found: boolean;
  maxG: number;
}

let walls = new Set<string>();
let start = { r: 4, c: 4 };
let goal = { r: 17, c: 32 };
let mode: "wall" | "start" | "goal" = "wall";
let isDragging = false;
let heatMap = false;
let showFrontier = false;
let currentPreset: PresetId = "random";

const svgA = document.getElementById("grid-astar") as unknown as SVGElement;
const svgD = document.getElementById("grid-dijkstra") as unknown as SVGElement;
const runBtn = document.getElementById("run") as HTMLButtonElement;
const stepBtn = document.getElementById("step") as HTMLButtonElement;
const resetBtn = document.getElementById("reset") as HTMLButtonElement;
const clearBtn = document.getElementById("clear") as HTMLButtonElement;
const presetSel = document.getElementById("preset") as HTMLSelectElement;
const exportBtn = document.getElementById("export") as HTMLButtonElement;
const heatBtn = document.getElementById("toggle-heat") as HTMLButtonElement;
const frontierBtn = document.getElementById("toggle-frontier") as HTMLButtonElement;
const speedInput = document.getElementById("speed") as HTMLInputElement;
const speedLabel = document.getElementById("speed-label")!;
const bannerHeadline = document.getElementById("banner-headline")!;
const bannerCost = document.getElementById("banner-cost")!;
const bannerFound = document.getElementById("banner-found")!;

for (const svg of [svgA, svgD]) {
  svg.setAttribute("viewBox", `0 0 ${COLS * CELL} ${ROWS * CELL}`);
}

function key(r: number, c: number): string { return `${r},${c}`; }
function isProtectedCell(r: number, c: number): boolean {
  return (r === start.r && c === start.c) || (r === goal.r && c === goal.c);
}

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
  const enqueues: Enqueue[] = [];
  let visitCount = 0;
  let maxG = 0;
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
      if (gScore > maxG) maxG = gScore;
      visitCount = step + 1;
    },
    onEnqueue: (nodeId, fScore) => {
      enqueues.push({ nodeId, fScore, visitIdx: visitCount });
    },
  });
  return {
    visits,
    enqueues,
    path: result.path,
    cost: result.cost,
    iterations: result.iterations,
    visited: result.visited,
    found: result.found,
    maxG,
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

// ---------------------------------------------------------------------------
// Persistent grid renderer (so CSS transitions on fill/opacity can fire).
// ---------------------------------------------------------------------------

class GridRenderer {
  private cells: SVGRectElement[][] = [];

  constructor(private svg: SVGElement) {
    this.build();
  }

  private build(): void {
    this.svg.innerHTML = "";
    const sz = CELL - 2 * CELL_PAD;
    const bg = document.createElementNS(NS, "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(COLS * CELL));
    bg.setAttribute("height", String(ROWS * CELL));
    bg.setAttribute("rx", "4");
    bg.setAttribute("fill", "#07080b");
    this.svg.appendChild(bg);

    // Subtle grid background pattern.
    const defs = document.createElementNS(NS, "defs");
    const pat = document.createElementNS(NS, "pattern");
    pat.setAttribute("id", `${this.svg.id}-gridpat`);
    pat.setAttribute("width", String(CELL));
    pat.setAttribute("height", String(CELL));
    pat.setAttribute("patternUnits", "userSpaceOnUse");
    const pline = document.createElementNS(NS, "path");
    pline.setAttribute("d", `M ${CELL} 0 L 0 0 0 ${CELL}`);
    pline.setAttribute("fill", "none");
    pline.setAttribute("stroke", "#14171f");
    pline.setAttribute("stroke-width", "0.5");
    pat.appendChild(pline);
    defs.appendChild(pat);
    this.svg.appendChild(defs);
    const bgGrid = document.createElementNS(NS, "rect");
    bgGrid.setAttribute("width", String(COLS * CELL));
    bgGrid.setAttribute("height", String(ROWS * CELL));
    bgGrid.setAttribute("fill", `url(#${this.svg.id}-gridpat)`);
    this.svg.appendChild(bgGrid);

    const g = document.createElementNS(NS, "g");
    this.svg.appendChild(g);
    for (let r = 0; r < ROWS; r++) {
      this.cells[r] = [];
      for (let c = 0; c < COLS; c++) {
        const rect = document.createElementNS(NS, "rect");
        rect.setAttribute("x", String(c * CELL + CELL_PAD));
        rect.setAttribute("y", String(r * CELL + CELL_PAD));
        rect.setAttribute("width", String(sz));
        rect.setAttribute("height", String(sz));
        rect.setAttribute("rx", "2.5");
        rect.setAttribute("class", "cell");
        rect.dataset.k = key(r, c);
        g.appendChild(rect);
        this.cells[r]![c] = rect;
      }
    }
  }

  draw(o: {
    visits: Visit[];
    enqueues: Enqueue[];
    path: string[];
    maxG: number;
    frameStep: number;
    pathStep: number;
    visitColor: string;
    heatmap: boolean;
    showFrontier: boolean;
  }): void {
    const { visits, enqueues, path, maxG, frameStep, pathStep, visitColor, heatmap, showFrontier } = o;

    // Visited membership + g-score (for heat map) up to frameStep.
    const visitedG = new Map<string, number>();
    const visitedIdx = new Map<string, number>();
    for (let i = 0; i < visits.length && i < frameStep; i++) {
      const v = visits[i]!;
      visitedG.set(v.nodeId, v.gScore);
      visitedIdx.set(v.nodeId, v.step);
    }
    // Frontier: enqueued at or before frameStep, minus already-visited.
    const frontier = showFrontier ? new Set<string>() : null;
    if (frontier) {
      for (const e of enqueues) {
        if (e.visitIdx <= frameStep) frontier.add(e.nodeId);
      }
      for (const id of frontier.keys()) {
        if (visitedG.has(id)) frontier.delete(id);
      }
    }
    const pathSet = new Set(path.slice(0, pathStep));
    const maxStep = Math.max(frameStep, 1);
    const gDivisor = maxG > 0 ? maxG : 1;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const el = this.cells[r]![c]!;
        const k = key(r, c);
        let fill = "transparent";
        let opacity = 1;
        let cls = "cell";

        if (walls.has(k)) {
          fill = C.wall;
        } else if (r === start.r && c === start.c) {
          fill = C.accent; cls = "cell glow-start";
        } else if (r === goal.r && c === goal.c) {
          fill = C.warm; cls = "cell glow-goal";
        } else if (pathSet.has(k)) {
          fill = C.path;
        } else if (visitedG.has(k)) {
          if (heatmap) {
            fill = heatColor(visitedG.get(k)! / gDivisor);
            const v = visitedIdx.get(k)!;
            opacity = 0.45 + (1 - (v / maxStep) * 0.5) * 0.5;
          } else {
            fill = visitColor;
            const v = visitedIdx.get(k)!;
            const fade = 1 - (v / maxStep) * 0.6;
            opacity = fade * 0.5;
          }
        } else if (showFrontier && frontier && frontier.has(k)) {
          cls = "cell frontier";
          fill = "transparent";
        }

        el.style.fill = fill;
        el.style.opacity = String(opacity);
        el.setAttribute("class", cls);
      }
    }
  }
}

const rendererA = new GridRenderer(svgA);
const rendererD = new GridRenderer(svgD);

function drawStatic(): void {
  rendererA.draw({ visits: [], enqueues: [], path: [], maxG: 0, frameStep: 0, pathStep: 0, visitColor: C.astar, heatmap: false, showFrontier: false });
  rendererD.draw({ visits: [], enqueues: [], path: [], maxG: 0, frameStep: 0, pathStep: 0, visitColor: C.dijkstra, heatmap: false, showFrontier: false });
}

// Cool (blue) -> warm (orange) gradient for the g-score heat map.
function heatColor(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  const r = Math.round(96 + (249 - 96) * x);
  const g = Math.round(165 + (115 - 165) * x);
  const b = Math.round(250 + (22 - 250) * x);
  return `rgb(${r},${g},${b})`;
}

function tick(now: number): void {
  if (!animState || !animState.playing) { rafId = 0; return; }
  const dt = (now - lastTickTime) / 1000;
  lastTickTime = now;
  const stepRate = speed;
  const totalVisits = Math.max(animState.astarRun.visits.length, animState.dijkstraRun.visits.length);
  animState.step = Math.min(totalVisits, animState.step + stepRate * dt);
  const visitsDone = animState.step >= totalVisits;
  const maxPath = Math.max(animState.astarRun.path.length, animState.dijkstraRun.path.length);
  if (visitsDone && animState.pathStep < maxPath) {
    animState.pathStep = Math.min(maxPath, animState.pathStep + stepRate * 0.5 * dt);
  }
  if (visitsDone && animState.pathStep >= maxPath) {
    animState.playing = false;
    animState.done = true;
    runBtn.textContent = "▶ Run";
  }
  updateUI();
  rafId = requestAnimationFrame(tick);
}

function updateUI(): void {
  if (!animState) return;
  const s = animState;
  const visitsToShowA = Math.min(s.astarRun.visits.length, Math.floor(s.step));
  const visitsToShowD = Math.min(s.dijkstraRun.visits.length, Math.floor(s.step));
  const pathToShowA = Math.min(s.astarRun.path.length, Math.floor(s.pathStep));
  const pathToShowD = Math.min(s.dijkstraRun.path.length, Math.floor(s.pathStep));

  rendererA.draw({
    visits: s.astarRun.visits, enqueues: s.astarRun.enqueues, path: s.astarRun.path,
    maxG: s.astarRun.maxG, frameStep: visitsToShowA, pathStep: pathToShowA,
    visitColor: C.astar, heatmap: heatMap, showFrontier,
  });
  rendererD.draw({
    visits: s.dijkstraRun.visits, enqueues: s.dijkstraRun.enqueues, path: s.dijkstraRun.path,
    maxG: s.dijkstraRun.maxG, frameStep: visitsToShowD, pathStep: pathToShowD,
    visitColor: C.dijkstra, heatmap: heatMap, showFrontier,
  });

  (document.getElementById("astar-visited")!).textContent = String(visitsToShowA);
  (document.getElementById("astar-path")!).textContent = s.astarRun.found ? String(s.astarRun.path.length) : "—";
  (document.getElementById("astar-cost")!).textContent = s.astarRun.found ? String(s.astarRun.cost) : "—";
  (document.getElementById("astar-iter")!).textContent = String(s.astarRun.iterations);

  (document.getElementById("dik-visited")!).textContent = String(visitsToShowD);
  (document.getElementById("dik-path")!).textContent = s.dijkstraRun.found ? String(s.dijkstraRun.path.length) : "—";
  (document.getElementById("dik-cost")!).textContent = s.dijkstraRun.found ? String(s.dijkstraRun.cost) : "—";
  (document.getElementById("dik-iter")!).textContent = String(s.dijkstraRun.iterations);

  const totalVisitMax = Math.max(s.astarRun.visits.length, s.dijkstraRun.visits.length, 1);
  (document.getElementById("prog-astar") as HTMLElement).style.width = `${(visitsToShowA / totalVisitMax) * 100}%`;
  (document.getElementById("prog-dijkstra") as HTMLElement).style.width = `${(visitsToShowD / totalVisitMax) * 100}%`;
}

function updateBanner(a: RunResult, d: RunResult): void {
  const aV = a.visited, dV = d.visited;
  let headline: string;
  if (!a.found || !d.found) {
    headline = a.found || d.found ? "One algorithm found a path" : "No path exists on this grid";
  } else if (aV === dV) {
    headline = `Both visited ${aV} node${aV === 1 ? "" : "s"}`;
  } else if (aV < dV) {
    const pct = Math.round((1 - aV / dV) * 100);
    headline = `<span class="hl">A* visited ${pct}% fewer nodes</span> than Dijkstra (${aV} vs ${dV})`;
  } else {
    const pct = Math.round((1 - dV / aV) * 100);
    headline = `<span class="hl loser">Dijkstra visited ${pct}% fewer nodes</span> than A* (${dV} vs ${aV})`;
  }
  bannerHeadline.innerHTML = headline;

  const aCost = a.found ? String(a.cost) : "—";
  const dCost = d.found ? String(d.cost) : "—";
  bannerCost.innerHTML = `<span class="cost-a">A* cost: ${aCost}</span> <span class="sep">·</span> <span class="cost-d">Dijkstra cost: ${dCost}</span>`;

  if (a.found && d.found) {
    bannerFound.textContent = "both found a path";
    bannerFound.className = "badge ok";
  } else if (!a.found && !d.found) {
    bannerFound.textContent = "no path";
    bannerFound.className = "badge bad";
  } else {
    bannerFound.textContent = "partial";
    bannerFound.className = "badge none";
  }
}

function resetBanner(): void {
  bannerHeadline.textContent = "Run the visualizer to compare A* and Dijkstra";
  bannerCost.innerHTML = `<span class="cost-a">A* cost: —</span> <span class="sep">·</span> <span class="cost-d">Dijkstra cost: —</span>`;
  bannerFound.textContent = "idle";
  bannerFound.className = "badge none";
}

function startRun(): void {
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
  updateBanner(astarResult, dijkstraResult);
  console.log("[Lakaw] A*:", { visited: astarResult.visited, iter: astarResult.iterations, cost: astarResult.cost });
  console.log("[Lakaw] Dijkstra:", { visited: dijkstraResult.visited, iter: dijkstraResult.iterations, cost: dijkstraResult.cost });
}

function togglePlay(): void {
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
  } else {
    rafId = 0;
  }
}

function stepOnce(): void {
  if (!animState) { startRun(); }
  if (!animState) return;
  animState.playing = false;
  runBtn.textContent = "▶ Run";
  rafId = 0;
  const totalVisits = Math.max(animState.astarRun.visits.length, animState.dijkstraRun.visits.length);
  if (animState.step < totalVisits) {
    animState.step = Math.min(totalVisits, animState.step + 1);
  } else {
    const maxPath = Math.max(animState.astarRun.path.length, animState.dijkstraRun.path.length);
    animState.pathStep = Math.min(maxPath, animState.pathStep + 1);
    animState.done = animState.pathStep >= maxPath;
  }
  updateUI();
}

function reset(): void {
  animState = null;
  runBtn.textContent = "▶ Run";
  cancelAnimationFrame(rafId);
  rafId = 0;
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
  resetBanner();
  drawStatic();
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

function clearVisState(): void {
  animState = null;
  runBtn.textContent = "▶ Run";
  cancelAnimationFrame(rafId);
  rafId = 0;
  resetBanner();
}

function paint(r: number, c: number): void {
  const k = key(r, c);
  if (mode === "wall") {
    if (isProtectedCell(r, c)) return;
    if (walls.has(k)) walls.delete(k); else walls.add(k);
  } else if (mode === "start") {
    if (walls.has(k)) return;
    start = { r, c };
  } else {
    if (walls.has(k)) return;
    goal = { r, c };
  }
  clearVisState();
  drawStatic();
}

// ---------------------------------------------------------------------------
// Preset maze layouts
// ---------------------------------------------------------------------------

function genPreset(name: PresetId): Set<string> {
  const w = new Set<string>();
  switch (name) {
    case "empty":
      break;
    case "random": {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (isProtectedCell(r, c)) continue;
          if (Math.random() < 0.3) w.add(key(r, c));
        }
      }
      break;
    }
    case "corridors": {
      // Horizontal wall bands with doorways, then vertical bands.
      for (let r = 3; r < ROWS - 1; r += 4) {
        const gap1 = Math.floor(Math.random() * (COLS - 2));
        const gap2 = (gap1 + Math.floor(COLS / 2)) % COLS;
        for (let c = 0; c < COLS; c++) {
          if (c === gap1 || c === gap2) continue;
          if (!isProtectedCell(r, c)) w.add(key(r, c));
        }
      }
      for (let c = 5; c < COLS - 1; c += 6) {
        const gap1 = Math.floor(Math.random() * ROWS);
        for (let r = 0; r < ROWS; r++) {
          if (r === gap1) continue;
          if (!isProtectedCell(r, c)) w.add(key(r, c));
        }
      }
      break;
    }
    case "spiral": {
      let r1 = 0, r2 = ROWS - 1, c1 = 0, c2 = COLS - 1;
      let gapSide = 0;
      while (r1 < r2 && c1 < c2) {
        // top edge (leave a gap to enter the next ring)
        for (let c = c1; c <= c2; c++) {
          if (gapSide % 4 === 0 && c === c1) continue;
          if (!isProtectedCell(r1, c)) w.add(key(r1, c));
        }
        // right edge
        for (let r = r1; r <= r2; r++) {
          if (gapSide % 4 === 1 && r === r2) continue;
          if (!isProtectedCell(r, c2)) w.add(key(r, c2));
        }
        // bottom edge
        for (let c = c2; c >= c1; c--) {
          if (gapSide % 4 === 2 && c === c2) continue;
          if (!isProtectedCell(r2, c)) w.add(key(r2, c));
        }
        // left edge
        for (let r = r2; r >= r1; r--) {
          if (gapSide % 4 === 3 && r === r1) continue;
          if (!isProtectedCell(r, c1)) w.add(key(r, c1));
        }
        r1 += 2; r2 -= 2; c1 += 2; c2 -= 2; gapSide++;
      }
      break;
    }
    case "rooms": {
      const roomR = 3, roomC = 4;
      const rh = Math.floor(ROWS / roomR);
      const rc = Math.floor(COLS / roomC);
      for (let i = 1; i < roomR; i++) {
        const wr = i * rh;
        const door1 = Math.floor(Math.random() * COLS);
        const door2 = (door1 + Math.floor(COLS / 2)) % COLS;
        for (let c = 0; c < COLS; c++) {
          if (c === door1 || c === door2) continue;
          if (!isProtectedCell(wr, c)) w.add(key(wr, c));
        }
      }
      for (let j = 1; j < roomC; j++) {
        const wc = j * rc;
        const door1 = Math.floor(Math.random() * ROWS);
        const door2 = (door1 + Math.floor(ROWS / 2)) % ROWS;
        for (let r = 0; r < ROWS; r++) {
          if (r === door1 || r === door2) continue;
          if (!isProtectedCell(r, wc)) w.add(key(r, wc));
        }
      }
      break;
    }
    case "recursive": {
      recursiveDivision(w, 0, 0, COLS, ROWS);
      break;
    }
  }
  return w;
}

function recursiveDivision(w: Set<string>, x: number, y: number, width: number, height: number): void {
  if (width < 3 || height < 3) return;
  const horizontal: boolean = height > width ? true : (width > height ? false : Math.random() < 0.5);
  if (horizontal) {
    const maxRow = height - 2;
    if (maxRow < 1) return;
    const wy = y + 1 + 2 * Math.floor(Math.random() * Math.floor((maxRow) / 2));
    const passage = x + 2 * Math.floor(Math.random() * Math.floor(width / 2));
    for (let c = x; c < x + width; c++) {
      if (c === passage) continue;
      if (!isProtectedCell(wy, c)) w.add(key(wy, c));
    }
    recursiveDivision(w, x, y, width, wy - y);
    recursiveDivision(w, x, wy + 1, width, y + height - wy - 1);
  } else {
    const maxCol = width - 2;
    if (maxCol < 1) return;
    const wx = x + 1 + 2 * Math.floor(Math.random() * Math.floor(maxCol / 2));
    const passage = y + 2 * Math.floor(Math.random() * Math.floor(height / 2));
    for (let r = y; r < y + height; r++) {
      if (r === passage) continue;
      if (!isProtectedCell(r, wx)) w.add(key(r, wx));
    }
    recursiveDivision(w, x, y, wx - x, height);
    recursiveDivision(w, wx + 1, y, x + width - wx - 1, height);
  }
}

function applyPreset(name: PresetId): void {
  currentPreset = name;
  presetSel.value = name;
  walls = genPreset(name);
  reset();
}

// ---------------------------------------------------------------------------
// Export comparison stats as JSON
// ---------------------------------------------------------------------------

function exportStats(): void {
  if (!animState) {
    const a = runAlgorithm(true);
    const d = runAlgorithm(false);
    downloadStats(a, d);
    return;
  }
  downloadStats(animState.astarRun, animState.dijkstraRun);
}

function downloadStats(a: RunResult, d: RunResult): void {
  const aFewer = Math.max(0, d.visited - a.visited);
  const bigger = Math.max(a.visited, d.visited);
  const pct = bigger > 0 ? Math.round((aFewer / bigger) * 100) : 0;
  const data = {
    astar: {
      visited: a.visited,
      iterations: a.iterations,
      cost: a.cost,
      pathLength: a.path.length,
      found: a.found,
    },
    dijkstra: {
      visited: d.visited,
      iterations: d.iterations,
      cost: d.cost,
      pathLength: d.path.length,
      found: d.found,
    },
    efficiency: {
      aStarFewerNodes: aFewer,
      percentReduction: pct,
    },
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a2 = document.createElement("a");
  a2.href = url;
  a2.download = "lakaw-stats.json";
  document.body.appendChild(a2);
  a2.click();
  document.body.removeChild(a2);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

for (const svg of [svgA, svgD]) {
  svg.addEventListener("mousedown", (e) => {
    isDragging = true;
    const cell = cellFromEvent(svg, e);
    if (cell) paint(cell.r, cell.c);
  });
  svg.addEventListener("mousemove", (e) => {
    if (!isDragging || mode !== "wall") return;
    const cell = cellFromEvent(svg, e);
    if (cell && !isProtectedCell(cell.r, cell.c)) {
      const k = key(cell.r, cell.c);
      if (!walls.has(k)) {
        walls.add(k);
        clearVisState();
        drawStatic();
      }
    }
  });
  svg.addEventListener("mouseup", () => { isDragging = false; });
  svg.addEventListener("mouseleave", () => { isDragging = false; });
}

document.querySelectorAll(".mode-selector button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-selector button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    mode = (btn as HTMLElement).dataset["mode"] as "wall" | "start" | "goal";
  });
});

runBtn.addEventListener("click", togglePlay);
stepBtn.addEventListener("click", stepOnce);
resetBtn.addEventListener("click", reset);
exportBtn.addEventListener("click", exportStats);
clearBtn.addEventListener("click", () => { applyPreset("empty"); });
presetSel.addEventListener("change", () => {
  const v = presetSel.value as PresetId;
  applyPreset(v);
});
heatBtn.addEventListener("click", () => {
  heatMap = !heatMap;
  heatBtn.classList.toggle("active", heatMap);
  if (animState) updateUI(); else drawStatic();
});
frontierBtn.addEventListener("click", () => {
  showFrontier = !showFrontier;
  frontierBtn.classList.toggle("active", showFrontier);
  if (animState) updateUI(); else drawStatic();
});

speedInput.addEventListener("input", () => {
  speed = parseInt(speedInput.value, 10);
  speedLabel.textContent = `${speed} cells/s`;
});

// Info panel collapsible.
const infoPanel = document.getElementById("info-panel")!;
document.getElementById("info-toggle")!.addEventListener("click", () => {
  infoPanel.classList.toggle("open");
});

// Keyboard shortcuts.
window.addEventListener("keydown", (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
  const k = e.key;
  switch (k) {
    case " ": e.preventDefault(); togglePlay(); break;
    case "s": case "S": stepOnce(); break;
    case "r": case "R": reset(); break;
    case "m": case "M": applyPreset("random"); break;
    case "c": case "C": applyPreset("empty"); break;
    case "h": case "H": heatBtn.click(); break;
    case "f": case "F": frontierBtn.click(); break;
    case "1": applyPreset("empty"); break;
    case "2": applyPreset("random"); break;
    case "3": applyPreset("corridors"); break;
    case "4": applyPreset("spiral"); break;
    case "5": applyPreset("rooms"); break;
    case "6": applyPreset("recursive"); break;
    default: break;
  }
});

// Initial layout for a good first impression.
applyPreset("random");
