import { describe, expect, it } from "vitest";
import { debug } from "./debug";
import { action, targets } from "./controls";
import {
  advance,
  initial,
  runs,
  resolve,
  legalSwap,
  parseBoard,
  cellX,
  cellY,
  stepHold,
  deal,
} from "./simulation";
import type { FacetState } from "./game";
import * as C from "./constants";

const rows = Array.from({ length: C.GRID_ROWS }, (_, r) =>
  Array.from(
    { length: C.GRID_COLS },
    (_, c) => "RACJBSM"[(r * 2 + c) % 7] + "0",
  ).join(" "),
);
function board(): FacetState {
  return debug.loadBoard({ ...initial(), screen: "playing" }, rows);
}
function put(s: FacetState, c: number, r: number, t: string) {
  return debug.setGem(s, c, r, t);
}
function line(n = 3, strain = 0): FacetState {
  let s = board();
  for (let i = 0; i < n; i++) s = put(s, i, 3, `R${strain}`);
  return { ...s, phase: "resolving", chainStep: 1 };
}
function refill(s: FacetState) {
  for (let c = 0; c < 8; c++)
    s = debug.setRefillKinds(
      s,
      c,
      Array.from({ length: 8 }, (_, r) => "RACJBSM"[(c + r * 2 + 3) % 7]).join(
        "",
      ),
    );
  return s;
}

describe("maximal runs and cut creation", () => {
  it("finds a maximal run once and excludes prisms", () => {
    let s = line(5);
    expect(
      runs(s.board.cells).filter((r) => r.horizontal && r.cells[0] === 24),
    ).toHaveLength(1);
    s = put(s, 2, 3, "X0");
    expect(
      runs(s.board.cells).filter((r) => r.horizontal && r.cells[0] === 24),
    ).toHaveLength(0);
  });
  it.each([
    [4, "brilliant"],
    [5, "prism"],
    [6, "prism"],
  ] as const)("a run of %i makes %s", (n, cut) => {
    const r = resolve(refill(line(n)))!;
    expect(r.state.board.cells.some((g) => g.cut === cut)).toBe(true);
    expect(r.cut).toBe(true);
  });
  it("makes a star at a crossing", () => {
    let s = line(3);
    s = put(s, 1, 2, "R0");
    s = put(s, 1, 4, "R0");
    expect(
      resolve(refill(s))!.state.board.cells.some((g) => g.cut === "star"),
    ).toBe(true);
  });
  it("uses the swapped cell in a four-run", () => {
    let s = line(4);
    s = {
      ...s,
      visual: {
        swap: [
          { col: 3, row: 3 },
          { col: 3, row: 2 },
        ],
      },
    };
    const r = resolve(refill(s))!;
    expect(r.state.board.cells.find((g) => g.cut === "brilliant")?.col).toBe(3);
  });
});

describe("strain, recursive expansion, and scoring", () => {
  it("strains a neighbor just once and caps it", () => {
    let s = line();
    s = put(s, 1, 2, "J2");
    const r = resolve(refill(s))!;
    expect(r.flaw).toBe(true);
    expect(r.state.board.cells.filter((g) => g.strain === 3)).toHaveLength(1);
    expect(r.state.lastPoints).toBe(30);
  });
  it("propagates across flawed stones in breadth-first waves", () => {
    let s = line();
    s = put(s, 2, 2, "J3");
    s = put(s, 2, 1, "B3");
    const r = resolve(refill(s))!;
    expect(r.state.lastCleared).toBe(5);
    expect(r.state.lastWaves).toBe(2);
    expect(r.state.lastPoints).toBe(70);
  });
  it("does not expand through a gem that only just becomes flawed", () => {
    let s = line();
    s = put(s, 2, 2, "J2");
    s = put(s, 2, 1, "B3");
    expect(resolve(refill(s))!.state.lastCleared).toBe(3);
  });
  it("expands brilliant rings and star rows recursively", () => {
    let s = line();
    s = put(s, 1, 3, "R0b");
    s = put(s, 2, 2, "J0s");
    const r = resolve(refill(s))!;
    expect(r.state.lastCleared).toBe(19);
    expect(r.state.lastWaves).toBeGreaterThan(0);
  });
  it("caps the score multiplier at eight", () => {
    const s = { ...line(3, 3), chainStep: 20 };
    expect(resolve(refill(s))!.state.lastPoints).toBe(
      3 * C.FLAWED_SCORE * C.MAX_MULTIPLIER,
    );
  });
  it("keeps survivors in order and retains strain and cuts", () => {
    let s = line();
    s = put(s, 0, 1, "M2b");
    const result = resolve(refill(s))!.state;
    expect(
      result.board.cells.find(
        (g) => g.col === 0 && g.kind === "amethyst" && g.cut === "brilliant",
      ),
    ).toMatchObject({ row: 2, fell: 1, strain: 2 });
  });
});

describe("swap transactions, prisms, and time", () => {
  it("refuses unproductive and nonadjacent swaps without mutating the board", () => {
    const s = board();
    const r = debug.requestSwap(s, 0, 0, 7, 7);
    expect(r.board).toBe(s.board);
    expect(r.refusal).toMatchObject({
      a: { col: 0, row: 0 },
      b: { col: 7, row: 7 },
    });
    expect(s.refusal).toBeNull();
    expect(advance(r, 0.3).refusal).toBeNull();
  });
  it("a prism clears its traded kind and no cuts are made", () => {
    let s = put(board(), 0, 0, "X0");
    s = refill(s);
    const swap = debug.requestSwap(s, 0, 0, 1, 0);
    expect(swap.phase).toBe("swapping");
    expect(swap.score).toBe(0);
    const at = advance(swap, C.SWAP_SECONDS);
    expect(at.chainStep).toBe(1);
    expect(at.lastCleared).toBe(
      s.board.cells.filter((g) => g.kind === "amber").length + 1,
    );
    expect(at.board.cells.some((g) => g.cut !== "plain")).toBe(false);
  });
  it("two prisms seed the whole board", () => {
    let s = put(put(board(), 0, 0, "X0"), 1, 0, "X0");
    s = refill(s);
    const r = advance(debug.requestSwap(s, 0, 0, 1, 0), C.SWAP_SECONDS);
    expect(r.lastCleared).toBe(64);
    expect(Math.max(...r.board.cells.map((g) => g.fell))).toBe(8);
  });
  it("continues through multiple timing boundaries in a large frame", () => {
    let s = refill(put(board(), 0, 0, "X0"));
    s = debug.requestSwap(s, 0, 0, 1, 0);
    const once = advance(s, 2);
    let many = s;
    for (let i = 0; i < 200; i++) many = advance(many, 0.01);
    expect(many.score).toBe(once.score);
    expect(many.board).toEqual(once.board);
    expect(many.phase).toBe(once.phase);
    expect(many.stepTimer).toBeCloseTo(once.stepTimer);
  });
  it("freezes board time on all nonplaying screens", () => {
    const s = debug.requestSwap(put(board(), 0, 0, "X0"), 0, 0, 1, 0);
    for (const screen of [
      "title",
      "howto",
      "paused",
      "levelclear",
      "gameover",
    ] as const) {
      const r = advance({ ...s, screen }, 3);
      expect(r.swapTimer).toBe(0);
      expect(r.board).toEqual(s.board);
      expect(r.simTime).toBe(3);
    }
  });
  it("completes a level at settlement, retaining its measured figures", () => {
    const s = refill({ ...line(), levelScore: 2000 });
    const r = resolve(s)!.state;
    const settled = advance(r, stepHold(r));
    expect(settled.screen).toBe("levelclear");
    expect(settled.bestMove).toBe(30);
    expect(settled.bestChain).toBe(1);
    expect(action(settled, "confirm")).toMatchObject({
      screen: "playing",
      level: 2,
      levelScore: 0,
      score: 30,
      bestMove: 0,
      bestChain: 0,
    });
  });
});

describe("pointer and menu routes", () => {
  it("offers without changing the board, withdraws, and plays only on release", () => {
    let s = put(board(), 0, 0, "X0");
    const original = s.board;
    s = debug.pointerDown(s, cellX(0), cellY(0), "touch");
    s = debug.pointerMove(s, cellX(1), cellY(0), "touch");
    expect(s.offer).toEqual({ col: 1, row: 0 });
    expect(s.board).toBe(original);
    s = debug.pointerMove(s, cellX(0), cellY(0), "touch");
    expect(s.offer).toBeNull();
    s = debug.pointerMove(s, cellX(1), cellY(0), "touch");
    s = debug.pointerUp(s, "touch");
    expect(s.phase).toBe("swapping");
    expect(s.selection).toBeNull();
    expect(s.pointer.device).toBe("touch");
  });
  it("supports tapping two neighbors and clears selection on an outside press", () => {
    let s = board();
    s = debug.pointerDown(s, 388, 144);
    s = debug.pointerUp(s);
    expect(s.selection).toEqual({ col: 0, row: 0 });
    s = debug.pointerDown(s, 460, 144);
    expect(s.offer).toEqual({ col: 1, row: 0 });
    s = debug.pointerUp(s);
    expect(s.refusal).not.toBeNull();
    s = debug.pointerDown(s, 50, 150);
    expect(s.selection).toBeNull();
  });
  it("ties on nearest cell choose the lower column", () => {
    expect(debug.pointerDown(board(), 424, 144).selection).toEqual({
      col: 0,
      row: 0,
    });
  });
  it("targets require release inside the armed item", () => {
    let s = initial();
    s = debug.pointerDown(s, 600, 450);
    s = debug.pointerMove(s, 600, 550);
    s = debug.pointerUp(s);
    expect(s.screen).toBe("title");
    s = debug.pointerDown(s, 600, 550);
    s = debug.pointerUp(s);
    expect(s.screen).toBe("howto");
    const t = targets(s)[0];
    s = debug.pointerDown(s, t.x + 10, t.y + 10);
    s = debug.pointerUp(s);
    expect(s.screen).toBe("title");
    expect(s.menuIndex).toBe(1);
  });
  it("navigates, wraps, pauses, resumes and abandons a round", () => {
    let s = action(initial(), "up");
    expect(s.menuIndex).toBe(1);
    s = action(s, "down");
    s = action(s, "confirm");
    expect(s.screen).toBe("playing");
    s = action(s, "pause");
    expect(s.screen).toBe("paused");
    s = action(s, "confirm");
    expect(s.screen).toBe("playing");
    s = action(action(action(s, "pause"), "down"), "confirm");
    expect(s.screen).toBe("title");
    expect(s.board.cells).toHaveLength(0);
  });
});

describe("debug contract and board generation", () => {
  it("deals no runs, always a legal swap, and an entering board", () => {
    for (let i = 0; i < 20; i++) {
      const b = deal();
      expect(runs(b.cells)).toHaveLength(0);
      expect(legalSwap({ board: b })).toBe(true);
      expect(b.cells.every((g) => g.fell >= g.row + 1)).toBe(true);
    }
  });
  it("reports derived fields immediately and poses independently", () => {
    let s = board();
    s = debug.setSelection(s, 7, 7);
    s = debug.setOffer(s, 6, 7);
    s = debug.setLevel(s, 4);
    s = debug.setBestChain(s, 7);
    s = debug.setBestMove(s, 900);
    s = debug.setMoveScore(s, 100);
    s = debug.setScore(s, 123);
    s = debug.setLevelScore(s, 51);
    s = debug.setMenuIndex(s, 17);
    const snap = debug.snapshot(s);
    expect(snap).toMatchObject({
      levelTarget: 8000,
      score: 123,
      bestMove: 900,
      moveScore: 100,
      bestChain: 7,
      menuIndex: 17,
    });
    expect(snap.board.cells[0]).toMatchObject({ x: 388, y: 144, fell: 0 });
    expect(debug.reconcile(s)).toEqual(s);
    expect(debug.clearOffer(s).selection).toEqual(s.selection);
    expect(debug.clearSelection(s).offer).toEqual(s.offer);
    expect(debug.clearBoard(s).board.cells).toHaveLength(0);
    expect(debug.reset({ ...s, muted: true })).toEqual(initial(true));
  });
  it("rejects invalid domains loudly", () => {
    const s = board();
    expect(() => parseBoard([])).toThrow();
    expect(() => debug.setGem(s, 0, 0, "X0b")).toThrow();
    expect(() => debug.setGem(s, 8, 0, "R0")).toThrow();
    expect(() => debug.setLevel(s, 0)).toThrow();
    expect(() => debug.setMenuIndex(s, -1)).toThrow();
    expect(() => debug.setRefillKinds(s, 0, "RX")).toThrow();
    expect(() => debug.setScreen(s, "bad" as never)).toThrow();
    expect(() => debug.setBestChain(s, 0.5)).toThrow();
  });
});

describe("end of round", () => {
  it("ends only after a chain settles on a board without a legal move", () => {
    let s = board();
    expect(legalSwap(s)).toBe(false);
    for (let c = 0; c < 3; c++) {
      s = put(s, c, 0, "R0");
      s = debug.setRefillKinds(s, c, "RAC"[c]);
    }
    const cleared = resolve({ ...s, phase: "resolving", chainStep: 1 })!.state;
    expect(cleared.screen).toBe("playing");
    const ended = advance(cleared, stepHold(cleared));
    expect(ended.screen).toBe("gameover");
    expect(ended.score).toBe(30);
    expect(action(ended, "back").board).toEqual(ended.board);
    expect(
      action({ ...ended, menuIndex: 1 }, "confirm").board.cells,
    ).toHaveLength(0);
  });
});
