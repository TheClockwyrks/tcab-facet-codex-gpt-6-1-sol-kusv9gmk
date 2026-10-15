import * as C from "./constants";
import type { CellRef, FacetState, PointerDevice, State } from "./game";
import {
  adjacent,
  cellX,
  cellY,
  deal,
  initial,
  requestSwap,
  same,
} from "./simulation";
export interface Target {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export function targets(s: State): Target[] {
  if (s.screen === "playing" || s.screen === "howto")
    return [
      {
        id: s.screen === "playing" ? "pause" : "back",
        x: 1080,
        y: 36,
        w: 144,
        h: C.TARGET_MIN_H,
      },
    ];
  return [0, 1].map((i) => ({
    id: `menu-${i}`,
    x: 490,
    y: 422 + i * 88,
    w: 300,
    h: C.TARGET_MIN_H,
  }));
}
export function changeScreen(
  s: State,
  screen: FacetState["screen"],
  menuIndex = 0,
): FacetState {
  return { ...s, screen, menuIndex, armedTarget: null };
}
function fresh(s: State): FacetState {
  return {
    ...initial(s.muted),
    screen: "playing",
    simTime: s.simTime,
    pointer: s.pointer,
    board: deal(),
    visual: { dealAt: s.simTime },
  };
}
export function choose(s: State): FacetState {
  if (s.screen === "title")
    return s.menuIndex === 0 ? fresh(s) : changeScreen(s, "howto");
  if (s.screen === "playing" || s.screen === "howto") return { ...s };
  if (s.menuIndex === 1)
    return {
      ...changeScreen(s, "title"),
      board: { cols: 0, rows: 0, cells: [] },
      phase: "idle",
      chainStep: 0,
      swapTimer: 0,
      stepTimer: 0,
      selection: null,
      offer: null,
      refusal: null,
      visual: undefined,
    };
  if (s.screen === "paused") return changeScreen(s, "playing");
  if (s.screen === "gameover") return fresh(s);
  return {
    ...changeScreen(s, "playing"),
    level: s.level + 1,
    levelScore: 0,
    bestMove: 0,
    bestChain: 0,
    board: deal(),
    visual: { dealAt: s.simTime },
    selection: null,
    offer: null,
    refusal: null,
  };
}
export function action(s: State, key: string): FacetState {
  if (key === "pause" && (s.screen === "playing" || s.screen === "paused"))
    return changeScreen(s, s.screen === "playing" ? "paused" : "playing");
  if (key === "back" && (s.screen === "howto" || s.screen === "gameover"))
    return changeScreen(s, "title", s.screen === "howto" ? 1 : 0);
  if (s.screen === "playing" || s.screen === "howto") return { ...s };
  if (key === "up" || key === "down")
    return { ...s, menuIndex: (s.menuIndex + (key === "up" ? -1 : 1) + 2) % 2 };
  if (key === "confirm") return choose(s);
  return { ...s };
}
function hitCell(s: State, x: number, y: number): CellRef | null {
  let best: CellRef | null = null,
    dist = C.GEM_HIT_R ** 2;
  for (const g of s.board.cells) {
    const d = (x - cellX(g.col)) ** 2 + (y - cellY(g.row)) ** 2;
    if (d <= dist && (d < dist || !best)) {
      best = { col: g.col, row: g.row };
      dist = d;
    }
  }
  return best;
}
export function pointer(
  s: State,
  type: "down" | "move" | "up",
  x: number,
  y: number,
  device: PointerDevice = "mouse",
): FacetState {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !["mouse", "pen", "touch"].includes(device)
  )
    throw new Error("Invalid pointer");
  let next: FacetState = {
    ...s,
    pointer: {
      x,
      y,
      device,
      down: type === "up" ? false : type === "down" ? true : s.pointer.down,
    },
  };
  const target = targets(s).find(
    (t) => x >= t.x && y >= t.y && x <= t.x + t.w && y <= t.y + t.h,
  );
  if (type === "down") next = { ...next, armedTarget: target?.id ?? null };
  if (target?.id.startsWith("menu-") && (type === "down" || !s.pointer.down))
    next = { ...next, menuIndex: Number(target.id.slice(5)) };
  if (type === "up" && s.armedTarget) {
    next = { ...next, armedTarget: null };
    if (target?.id === s.armedTarget)
      return target.id === "pause"
        ? action(next, "pause")
        : target.id === "back"
          ? action(next, "back")
          : choose(next);
    return next;
  }
  if (s.screen !== "playing" || target || s.armedTarget) return next;
  const cell = hitCell(next, x, y);
  if (type === "down") {
    if (!cell) return { ...next, selection: null, offer: null };
    if (
      !s.selection ||
      (!same(s.selection, cell) && !adjacent(s.selection, cell))
    )
      return { ...next, selection: cell, offer: null };
    return { ...next, offer: same(s.selection, cell) ? null : cell };
  }
  if (type === "move" && next.pointer.down && cell && s.selection) {
    if (same(s.selection, cell)) return { ...next, offer: null };
    if (adjacent(s.selection, cell)) return { ...next, offer: cell };
  }
  if (type === "up" && s.selection && s.offer)
    return {
      ...requestSwap(
        next,
        s.selection.col,
        s.selection.row,
        s.offer.col,
        s.offer.row,
      ),
      selection: null,
      offer: null,
    };
  return next;
}
