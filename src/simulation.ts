import * as C from "./constants";
import type {
  BoardState,
  CellRef,
  Cut,
  FacetState,
  GemKind,
  GemState,
  State,
} from "./game";

export const cellX = (col: number) =>
  C.BOARD_CX - ((C.GRID_COLS - 1) * C.CELL_PITCH) / 2 + col * C.CELL_PITCH;
export const cellY = (row: number) =>
  C.BOARD_CY - ((C.GRID_ROWS - 1) * C.CELL_PITCH) / 2 + row * C.CELL_PITCH;
export const index = (p: CellRef) => p.row * C.GRID_COLS + p.col;
export const adjacent = (a: CellRef, b: CellRef) =>
  Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
export const same = (
  a: CellRef | null | undefined,
  b: CellRef | null | undefined,
) => !!a && !!b && index(a) === index(b);
export function validCell(col: number, row: number): CellRef {
  if (
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    col < 0 ||
    col >= C.GRID_COLS ||
    row < 0 ||
    row >= C.GRID_ROWS
  )
    throw new Error("Cell outside board");
  return { col, row };
}
export function nonnegative(n: number) {
  if (!Number.isFinite(n) || n < 0)
    throw new Error("Expected a nonnegative number");
  return n;
}
export function integer(n: number) {
  nonnegative(n);
  if (!Number.isInteger(n)) throw new Error("Expected an integer");
  return n;
}
export const letters = "RACJBSM";
export function token(value: string, col: number, row: number): GemState {
  if (!/^(?:[RACJBSM][0-3][bs]?|X[0-3])$/.test(value))
    throw new Error(`Invalid gem: ${value}`);
  return {
    col,
    row,
    kind: value[0] === "X" ? null : C.GEM_KINDS[letters.indexOf(value[0])],
    strain: Number(value[1]),
    cut:
      value[0] === "X"
        ? "prism"
        : value[2] === "b"
          ? "brilliant"
          : value[2] === "s"
            ? "star"
            : "plain",
    fell: 0,
  };
}
export function parseBoard(rows: readonly string[]): BoardState {
  if (rows.length !== C.GRID_ROWS) throw new Error("Expected eight rows");
  return {
    cols: C.GRID_COLS,
    rows: C.GRID_ROWS,
    cells: rows.flatMap((row, r) => {
      const ts = row.trim().split(/\s+/);
      if (ts.length !== C.GRID_COLS) throw new Error("Expected eight columns");
      return ts.map((t, c) => token(t, c, r));
    }),
  };
}
export function initial(muted = false): FacetState {
  return {
    screen: "title",
    menuIndex: 0,
    board: { cols: 0, rows: 0, cells: [] },
    phase: "idle",
    chainStep: 0,
    swapTimer: 0,
    stepTimer: 0,
    score: 0,
    level: 1,
    levelScore: 0,
    lastCleared: 0,
    lastPoints: 0,
    lastWaves: 0,
    moveScore: 0,
    bestMove: 0,
    bestChain: 0,
    selection: null,
    offer: null,
    refusal: null,
    armedTarget: null,
    pointer: { x: 0, y: 0, down: false, device: "mouse" },
    simTime: 0,
    muted,
    refillKinds: Array<string>(C.GRID_COLS).fill(""),
  };
}
export interface Run {
  cells: number[];
  horizontal: boolean;
  kind: GemKind;
}
export function runs(cells: readonly GemState[]): Run[] {
  const result: Run[] = [];
  for (const horizontal of [true, false])
    for (let outer = 0; outer < C.GRID_ROWS; outer++) {
      let at = 0;
      while (at < C.GRID_COLS) {
        const start = at,
          ids: number[] = [];
        const id = (n: number) =>
          horizontal ? outer * C.GRID_COLS + n : n * C.GRID_COLS + outer;
        const kind = cells[id(at)]?.kind;
        while (at < C.GRID_COLS && cells[id(at)]?.kind === kind)
          ids.push(id(at++));
        if (at === start) at++;
        if (kind && ids.length >= C.MATCH_MIN)
          result.push({ cells: ids, horizontal, kind });
      }
    }
  return result;
}
function exchanged(cells: readonly GemState[], a: CellRef, b: CellRef) {
  return cells.map((g, i) =>
    i === index(a)
      ? { ...cells[index(b)], ...a, fell: 0 }
      : i === index(b)
        ? { ...cells[index(a)], ...b, fell: 0 }
        : g,
  );
}
export function productive(cells: readonly GemState[], a: CellRef, b: CellRef) {
  return (
    !!cells[index(a)] &&
    !!cells[index(b)] &&
    adjacent(a, b) &&
    (cells[index(a)].cut === "prism" ||
      cells[index(b)].cut === "prism" ||
      runs(exchanged(cells, a, b)).length > 0)
  );
}
export function legalSwap(s: Pick<State, "board">): boolean {
  return s.board.cells.some((g) =>
    [
      { col: g.col + 1, row: g.row },
      { col: g.col, row: g.row + 1 },
    ].some(
      (b) =>
        b.col < C.GRID_COLS &&
        b.row < C.GRID_ROWS &&
        productive(s.board.cells, g, b),
    ),
  );
}
const randomKind = () =>
  C.GEM_KINDS[Math.floor(Math.random() * C.GEM_KIND_COUNT)];
export function deal(): BoardState {
  for (;;) {
    const cells: GemState[] = [];
    for (let row = 0; row < C.GRID_ROWS; row++)
      for (let col = 0; col < C.GRID_COLS; col++) {
        let kind: GemKind;
        do {
          kind = randomKind();
        } while (
          (col >= 2 &&
            cells[row * C.GRID_COLS + col - 1].kind === kind &&
            cells[row * C.GRID_COLS + col - 2].kind === kind) ||
          (row >= 2 &&
            cells[(row - 1) * C.GRID_COLS + col].kind === kind &&
            cells[(row - 2) * C.GRID_COLS + col].kind === kind)
        );
        cells.push({ col, row, kind, cut: "plain", strain: 0, fell: row + 1 });
      }
    const board = { cols: C.GRID_COLS, rows: C.GRID_ROWS, cells };
    if (legalSwap({ board })) return board;
  }
}
export function requestSwap(
  s: State,
  colA: number,
  rowA: number,
  colB: number,
  rowB: number,
): FacetState {
  const a = validCell(colA, rowA),
    b = validCell(colB, rowB);
  if (!s.board.cells[index(a)] || !s.board.cells[index(b)])
    throw new Error("No board in play");
  if (s.phase !== "idle" || !productive(s.board.cells, a, b))
    return { ...s, refusal: { a, b, timer: 0 } };
  return {
    ...s,
    board: { ...s.board, cells: exchanged(s.board.cells, a, b) },
    phase: "swapping",
    swapTimer: 0,
    stepTimer: 0,
    chainStep: 0,
    moveScore: 0,
    refusal: null,
    visual: { swap: [a, b], before: s.board.cells },
  };
}
export const lastFall = (s: State) =>
  Math.max(0, ...s.board.cells.map((g) => g.fell));
export const stepHold = (s: State) =>
  s.lastWaves * C.WAVE_SECONDS +
  lastFall(s) * C.FALL_SECONDS_PER_ROW +
  C.STEP_SECONDS;
function neighbors(i: number, diagonal = false): number[] {
  const col = i % C.GRID_COLS,
    row = Math.floor(i / C.GRID_COLS),
    out: number[] = [];
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++)
      if (
        (x || y) &&
        (diagonal || Math.abs(x) + Math.abs(y) === 1) &&
        col + x >= 0 &&
        col + x < C.GRID_COLS &&
        row + y >= 0 &&
        row + y < C.GRID_ROWS
      )
        out.push((row + y) * C.GRID_COLS + col + x);
  return out;
}
export interface StepResult {
  state: FacetState;
  flaw: boolean;
  cut: boolean;
}
export function resolve(s: State): StepResult | null {
  const cells = s.board.cells,
    found = runs(cells),
    seeds = new Set(found.flatMap((r) => r.cells));
  let prism = false;
  if (s.chainStep === 1 && s.visual?.swap) {
    const [a, b] = s.visual.swap.map(index),
      ga = cells[a],
      gb = cells[b];
    if (ga.cut === "prism" || gb.cut === "prism") {
      prism = true;
      seeds.clear();
      cells.forEach((g, i) => {
        if (
          (ga.cut === "prism" && gb.cut === "prism") ||
          i === (ga.cut === "prism" ? a : b) ||
          g.kind === (ga.cut === "prism" ? gb.kind : ga.kind)
        )
          seeds.add(i);
      });
    }
  }
  if (!seeds.size) return null;
  const wave = new Map<number, number>();
  const queue = [...seeds];
  queue.forEach((i) => wave.set(i, 0));
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q],
      g = cells[i],
      add = neighbors(i).filter((j) => cells[j].strain === C.MAX_STRAIN);
    if (g.cut === "brilliant") add.push(...neighbors(i, true));
    if (g.cut === "star")
      cells.forEach((v, j) => {
        if (v.col === g.col || v.row === g.row) add.push(j);
      });
    for (const j of add)
      if (!wave.has(j)) {
        wave.set(j, wave.get(i)! + 1);
        queue.push(j);
      }
  }
  let flaw = false;
  const created = new Map<number, GemState>();
  const rank: Record<Cut, number> = {
    plain: 0,
    brilliant: 1,
    star: 2,
    prism: 3,
  };
  const create = (i: number, cut: Cut, kind: GemKind) => {
    if (!created.has(i) || rank[cut] > rank[created.get(i)!.cut])
      created.set(i, {
        ...cells[i],
        kind: cut === "prism" ? null : kind,
        cut,
        strain: 0,
        fell: 0,
      });
  };
  if (!prism) {
    for (const run of found)
      if (run.cells.length >= 4) {
        const swapped = s.visual?.swap?.map(index) ?? [];
        const at =
          run.cells.find((i) => swapped.includes(i)) ??
          run.cells[Math.floor((run.cells.length - 1) / 2)];
        create(at, run.cells.length >= 5 ? "prism" : "brilliant", run.kind);
      }
    for (const h of found.filter((r) => r.horizontal))
      for (const v of found.filter((r) => !r.horizontal))
        for (const i of h.cells)
          if (v.cells.includes(i)) create(i, "star", h.kind);
  }
  const multiplier = Math.min(s.chainStep, C.MAX_MULTIPLIER);
  const points = queue.reduce(
    (sum, i) =>
      sum +
      (cells[i].strain === C.MAX_STRAIN ? C.FLAWED_SCORE : C.BASE_SCORE) *
        multiplier,
    0,
  );
  const standing = cells.map((g, i) => {
    if (wave.has(i)) return created.get(i) ?? null;
    const strain = neighbors(i).some((j) => wave.has(j))
      ? Math.min(C.MAX_STRAIN, g.strain + 1)
      : g.strain;
    if (strain === C.MAX_STRAIN && g.strain < C.MAX_STRAIN) flaw = true;
    return { ...g, strain, fell: 0 };
  });
  const next: GemState[] = Array(cells.length);
  for (let col = 0; col < C.GRID_COLS; col++) {
    let dest = C.GRID_ROWS - 1;
    for (let row = C.GRID_ROWS - 1; row >= 0; row--) {
      const g = standing[row * C.GRID_COLS + col];
      if (g) {
        next[dest * C.GRID_COLS + col] = { ...g, row: dest, fell: dest - row };
        dest--;
      }
    }
    for (let row = dest; row >= 0; row--) {
      const k = s.refillKinds[col]?.[row];
      next[row * C.GRID_COLS + col] = {
        col,
        row,
        kind: k ? C.GEM_KINDS[letters.indexOf(k)] : randomKind(),
        strain: 0,
        cut: "plain",
        fell: dest + 1,
      };
    }
  }
  return {
    state: {
      ...s,
      board: { ...s.board, cells: next },
      score: s.score + points,
      levelScore: s.levelScore + points,
      moveScore: s.moveScore + points,
      bestChain: Math.max(s.bestChain, s.chainStep),
      lastPoints: points,
      lastCleared: queue.length,
      lastWaves: Math.max(...wave.values()),
      stepTimer: 0,
      visual: {
        ...s.visual,
        before: cells,
        cleared: queue.map((i) => ({ gem: cells[i], wave: wave.get(i)! })),
        created: [...created.values()].map((g) => ({ col: g.col, row: g.row })),
      },
    },
    flaw,
    cut: created.size > 0,
  };
}
export function advance(
  s: State,
  dt: number,
  emit: (cue: string, multiplier?: number) => void = () => {},
): FacetState {
  let next: FacetState = { ...s, simTime: s.simTime + dt };
  if (s.screen !== "playing")
    return s.visual?.dealAt === undefined
      ? next
      : { ...next, visual: { ...s.visual, dealAt: s.visual.dealAt + dt } };
  if (s.refusal)
    next = {
      ...next,
      refusal:
        s.refusal.timer + dt >= C.REFUSAL_SECONDS
          ? null
          : { ...s.refusal, timer: s.refusal.timer + dt },
    };
  let remaining = dt;
  for (let guard = 0; guard < 1000; guard++) {
    if (next.phase === "idle") break;
    const duration =
      next.phase === "swapping" ? C.SWAP_SECONDS : stepHold(next);
    const timer = next.phase === "swapping" ? next.swapTimer : next.stepTimer;
    const use = Math.min(remaining, Math.max(0, duration - timer));
    if (next.phase === "resolving") {
      const landAt =
        next.lastWaves * C.WAVE_SECONDS +
        lastFall(next) * C.FALL_SECONDS_PER_ROW;
      if (
        timer < landAt &&
        timer + use >= landAt &&
        lastFall(next) > C.LAND_MIN_ROWS
      )
        emit(C.CUES.land);
    }
    next =
      next.phase === "swapping"
        ? { ...next, swapTimer: timer + use }
        : { ...next, stepTimer: timer + use };
    remaining -= use;
    if (timer + use + 1e-9 < duration) break;
    next = {
      ...next,
      phase: "resolving",
      swapTimer: 0,
      stepTimer: 0,
      chainStep: next.phase === "swapping" ? 1 : next.chainStep + 1,
    };
    const result = resolve(next);
    if (result) {
      next = result.state;
      emit(C.CUES.clear, Math.min(next.chainStep, C.MAX_MULTIPLIER));
      if (result.flaw) emit(C.CUES.flaw);
      if (result.cut) emit(C.CUES.cut);
    } else {
      next = {
        ...next,
        phase: "idle",
        chainStep: 0,
        stepTimer: 0,
        bestMove: Math.max(next.bestMove, next.moveScore),
      };
      if (next.levelScore >= C.LEVEL_TARGET_STEP * next.level) {
        next = {
          ...next,
          screen: "levelclear",
          menuIndex: 0,
          armedTarget: null,
        };
        emit(C.CUES.levelUp);
      } else if (!legalSwap(next)) {
        next = { ...next, screen: "gameover", menuIndex: 0, armedTarget: null };
        emit(C.CUES.gameOver);
      }
      break;
    }
    if (remaining <= 1e-10) break;
  }
  return next;
}
