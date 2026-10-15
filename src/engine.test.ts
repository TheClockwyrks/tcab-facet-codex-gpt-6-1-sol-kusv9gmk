/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import * as C from "./constants";
import { runs } from "./simulation";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    async (url: string) =>
      new Response(
        await readFile(new URL(`../public/${url}`, import.meta.url)),
      ),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(Buffer.from(await blob.arrayBuffer())),
  );
  // The Node host has no audio device. Decode is supplied; cue and loop events still go through the real engine bus.
  vi.stubGlobal(
    "AudioContext",
    class {
      async decodeAudioData() {
        return { duration: 1 };
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
function engine() {
  const canvas = createCanvas(C.STAGE_W, C.STAGE_H);
  return createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(10),
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => new EventTarget(),
    },
  });
}
const rows = Array.from({ length: 8 }, (_, r) =>
  Array.from({ length: 8 }, (_, c) => "RACJBSM"[(c + r * 2) % 7] + "0").join(
    " ",
  ),
);
describe("the actual engine and committed assets", () => {
  it("initializes every asset, registers actions and renders every screen", async () => {
    const e = engine();
    await e.initialize();
    expect(e.debug.version).toBe(C.FACET_DEBUG_VERSION);
    for (const screen of [
      "title",
      "howto",
      "playing",
      "paused",
      "levelclear",
      "gameover",
    ] as const) {
      e.apply((s) => e.debug.loadBoard(s, rows));
      e.apply((s) => e.debug.setScreen(s, screen));
      await e.advance(1);
      expect(e.debug.snapshot(e.state).screen).toBe(screen);
    }
    expect(e.state.simTime).toBeCloseTo(0.06);
    e.destroy();
  });
  it("poses a swap and advances exact frames through clear, fall, and settlement", async () => {
    const e = engine();
    await e.initialize();
    e.apply((s) => e.debug.loadBoard(s, rows));
    e.apply((s) => e.debug.setScreen(s, "playing"));
    e.apply((s) => e.debug.setGem(s, 0, 0, "X0"));
    for (let c = 0; c < 8; c++)
      e.apply((s) =>
        e.debug.setRefillKinds(
          s,
          c,
          Array.from(
            { length: 8 },
            (_, r) => "RACJBSM"[(c + r * 2 + 3) % 7],
          ).join(""),
        ),
      );
    e.apply((s) => e.debug.requestSwap(s, 0, 0, 1, 0));
    await e.advance(17);
    expect(e.state.phase).toBe("swapping");
    expect(e.state.score).toBe(0);
    await e.advance(1);
    expect(e.state.phase).toBe("resolving");
    expect(e.state.lastCleared).toBeGreaterThan(1);
    await e.advance(200);
    expect(e.state.phase).toBe("idle");
    expect(e.state.bestMove).toBe(e.state.moveScore);
    expect(runs(e.state.board.cells)).toHaveLength(0);
    expect(e.state.board.cells.some((g) => g.fell > 0)).toBe(true);
    e.destroy();
  });
});
