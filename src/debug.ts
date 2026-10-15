import * as C from "./constants";
import type { FacetState, State, Screen, PointerDevice } from "./game";
import {
  cellX,
  cellY,
  deal,
  initial,
  integer,
  lastFall,
  legalSwap,
  letters,
  nonnegative,
  parseBoard,
  requestSwap,
  stepHold,
  token,
  validCell,
  index,
} from "./simulation";
import { pointer, targets } from "./controls";
export function snapshot(s: State) {
  return {
    version: C.FACET_DEBUG_VERSION,
    screen: s.screen,
    menuIndex: s.menuIndex,
    score: s.score,
    level: s.level,
    levelScore: s.levelScore,
    levelTarget: C.LEVEL_TARGET_STEP * s.level,
    phase: s.phase,
    chainStep: s.chainStep,
    multiplier: Math.min(s.chainStep, C.MAX_MULTIPLIER),
    swapTimer: s.swapTimer,
    stepTimer: s.stepTimer,
    stepHold: stepHold(s),
    board: {
      ...s.board,
      cells: s.board.cells.map((g) => ({
        ...g,
        x: cellX(g.col),
        y: cellY(g.row),
      })),
    },
    selection: s.selection ? { ...s.selection } : null,
    offer: s.offer ? { ...s.offer } : null,
    refusal: s.refusal
      ? { a: { ...s.refusal.a }, b: { ...s.refusal.b } }
      : null,
    lastCleared: s.lastCleared,
    lastPoints: s.lastPoints,
    lastWaves: s.lastWaves,
    lastFall: lastFall(s),
    moveScore: s.moveScore,
    bestMove: s.bestMove,
    bestChain: s.bestChain,
    legalSwap: legalSwap(s),
    refillKinds: [...s.refillKinds],
    pointer: { ...s.pointer },
    armedTarget: s.armedTarget,
    targets: targets(s),
    muted: s.muted,
    simTime: s.simTime,
  };
}
export const debug = {
  version: C.FACET_DEBUG_VERSION,
  reset: (s: State): FacetState => initial(s.muted),
  reconcile: (s: State): FacetState => ({ ...s }),
  snapshot,
  setScreen(s: State, screen: Screen): FacetState {
    if (
      ![
        "title",
        "howto",
        "playing",
        "paused",
        "levelclear",
        "gameover",
      ].includes(screen)
    )
      throw new Error("Invalid screen");
    return { ...s, screen };
  },
  setMenuIndex: (s: State, menuIndex: number): FacetState => ({
    ...s,
    menuIndex: integer(menuIndex),
  }),
  loadBoard: (s: State, rows: readonly string[]): FacetState => ({
    ...s,
    board: parseBoard(rows),
  }),
  dealBoard: (s: State): FacetState => ({
    ...s,
    board: deal(),
    visual: { dealAt: s.simTime },
  }),
  clearBoard: (s: State): FacetState => ({
    ...s,
    board: { cols: 0, rows: 0, cells: [] },
  }),
  setGem(s: State, col: number, row: number, value: string): FacetState {
    const p = validCell(col, row);
    if (!s.board.cells[index(p)]) throw new Error("No board");
    return {
      ...s,
      board: {
        ...s.board,
        cells: s.board.cells.map((g, i) =>
          i === index(p) ? token(value, col, row) : g,
        ),
      },
    };
  },
  setRefillKinds(s: State, col: number, kinds: string): FacetState {
    validCell(col, 0);
    if (!/^[RACJBSM]*$/.test(kinds)) throw new Error("Invalid refill");
    return {
      ...s,
      refillKinds: s.refillKinds.map((k, c) => (c === col ? kinds : k)),
    };
  },
  clearRefillKinds: (s: State): FacetState => ({
    ...s,
    refillKinds: Array<string>(C.GRID_COLS).fill(""),
  }),
  setScore: (s: State, score: number): FacetState => ({
    ...s,
    score: nonnegative(score),
  }),
  setLevel(s: State, level: number): FacetState {
    integer(level);
    if (level < 1) throw new Error("Level must be positive");
    return { ...s, level };
  },
  setLevelScore: (s: State, levelScore: number): FacetState => ({
    ...s,
    levelScore: nonnegative(levelScore),
  }),
  setBestChain: (s: State, bestChain: number): FacetState => ({
    ...s,
    bestChain: integer(bestChain),
  }),
  setBestMove: (s: State, bestMove: number): FacetState => ({
    ...s,
    bestMove: nonnegative(bestMove),
  }),
  setMoveScore: (s: State, moveScore: number): FacetState => ({
    ...s,
    moveScore: nonnegative(moveScore),
  }),
  setSelection: (s: State, col: number, row: number): FacetState => ({
    ...s,
    selection: validCell(col, row),
  }),
  clearSelection: (s: State): FacetState => ({ ...s, selection: null }),
  setOffer: (s: State, col: number, row: number): FacetState => ({
    ...s,
    offer: validCell(col, row),
  }),
  clearOffer: (s: State): FacetState => ({ ...s, offer: null }),
  clearRefusal: (s: State): FacetState => ({ ...s, refusal: null }),
  clearChain: (s: State): FacetState => ({
    ...s,
    phase: "idle",
    chainStep: 0,
    swapTimer: 0,
    stepTimer: 0,
  }),
  requestSwap,
  pointerDown: (
    s: State,
    x: number,
    y: number,
    device: PointerDevice = "mouse",
  ) => pointer(s, "down", x, y, device),
  pointerMove: (
    s: State,
    x: number,
    y: number,
    device: PointerDevice = "mouse",
  ) => pointer(s, "move", x, y, device),
  pointerUp: (s: State, device: PointerDevice = "mouse") =>
    pointer(s, "up", s.pointer.x, s.pointer.y, device),
};
export const kindLetter = (kind: string) =>
  letters[C.GEM_KINDS.indexOf(kind as (typeof C.GEM_KINDS)[number])];
