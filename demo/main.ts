import { GridGraph, astar } from "../src";

const ROWS = 24;
const COLS = 32;
const CELL = 22;

let walls = new Set<string>();
let start = { r: 4, c: 4 };
let goal = { r: 19, c: 27 };
let mode: "wall" | "start" | "goal" = "wall";
let isDragging = false;
let visitedSet: Set<string> = new Set();
let pathSet: Set<string> = new Set();

const svg = document.getElementById("grid") as SVGElement;
const costEl = document.getElementById("stat-cost")!;
const visitedEl = document.getElementById("stat-visited")!;
const iterEl = document.getElementById("stat-iter")!;
const pathEl = document.getElementById("stat-path")!;
const runBtn = document.getElementById("run")!;
const clearBtn = document.getElementById("clear")!;
const mazeBtn = document.getElementById("maze")!;

svg.setAttribute("viewBox", `0 0 ${COLS * CELL} ${ROWS * CELL}`);

function key(r: number, c: number) { return `${r},${c}`; }

function render() {
  const pathKey = new Set(pathSet);
  const visitedKey = new Set(visitedSet);
  const cells: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = key(r, c);
      const x = c * CELL;
      const y = r * CELL;
      let fill = "transparent";
      if (r === start.r && c === start.c) fill = "var(--accent)";
      else if (r === goal.r && c === goal.c) fill = "var(--warm)";
      else if (walls.has(k)) fill = "var(--line)";
      else if (pathKey.has(k)) fill = "var(--cool)";
      else if (visitedKey.has(k)) fill = "var(--visited)";
      cells.push(`<rect x="${x + 1}" y="${y + 1}" width="${CELL - 2}" height="${CELL - 2}" rx="3" fill="${fill}" stroke="var(--line)" stroke-width="0.5" data-k="${k}"/>`);
    }
  }
  svg.innerHTML = cells.join("");
}

function cellFromEvent(e: MouseEvent): { r: number; c: number } | null {
  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const scaleX = (COLS * CELL) / rect.width;
  const scaleY = (ROWS * CELL) / rect.height;
  const c = Math.floor(x * scaleX / CELL);
  const r = Math.floor(y * scaleY / CELL);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  return { r, c };
}

function paint(r: number, c: number) {
  if (mode === "wall") {
    if (r === start.r && c === start.c) return;
    if (r === goal.r && c === goal.c) return;
    const k = key(r, c);
    if (walls.has(k)) walls.delete(k); else walls.add(k);
  } else if (mode === "start") {
    if (walls.has(key(r, c))) return;
    start = { r, c };
  } else {
    if (walls.has(key(r, c))) return;
    goal = { r, c };
  }
  visitedSet = new Set();
  pathSet = new Set();
  costEl.textContent = "—";
  visitedEl.textContent = "—";
  iterEl.textContent = "—";
  pathEl.textContent = "—";
  render();
}

svg.addEventListener("mousedown", (e) => {
  isDragging = true;
  const cell = cellFromEvent(e);
  if (cell) paint(cell.r, cell.c);
});
svg.addEventListener("mousemove", (e) => {
  if (!isDragging || mode === "start" || mode === "goal") return;
  const cell = cellFromEvent(e);
  if (cell && !(cell.r === start.r && cell.c === start.c) && !(cell.r === goal.r && cell.c === goal.c)) {
    const k = key(cell.r, cell.c);
    if (!walls.has(k)) walls.add(k);
    render();
  }
});
svg.addEventListener("mouseup", () => { isDragging = false; });
svg.addEventListener("mouseleave", () => { isDragging = false; });

document.querySelectorAll(".mode button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    mode = (btn as HTMLElement).dataset["mode"] as any;
  });
});

runBtn.addEventListener("click", () => {
  const result = GridGraph.solve(ROWS, COLS, walls, start.r, start.c, goal.r, goal.c);
  visitedSet = new Set();
  pathSet = new Set(result.path);
  costEl.textContent = result.found ? String(result.cost) : "—";
  visitedEl.textContent = String(result.visited);
  iterEl.textContent = String(result.iterations);
  pathEl.textContent = result.found ? String(result.path.length) : "0";
  if (!result.found) {
    const g = new GridGraph(ROWS, COLS, walls, goal.r, goal.c);
    const approx = astar({ graph: g, start: key(start.r, start.c), isGoal: (id) => id === key(goal.r, goal.c) });
    visitedSet = new Set();
  }
  render();
});

clearBtn.addEventListener("click", () => {
  walls = new Set();
  visitedSet = new Set();
  pathSet = new Set();
  costEl.textContent = "—";
  visitedEl.textContent = "—";
  iterEl.textContent = "—";
  pathEl.textContent = "—";
  render();
});

mazeBtn.addEventListener("click", () => {
  walls = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === start.r && c === start.c) continue;
      if (r === goal.r && c === goal.c) continue;
      if (Math.random() < 0.28) walls.add(key(r, c));
    }
  }
  visitedSet = new Set();
  pathSet = new Set();
  render();
});

render();
