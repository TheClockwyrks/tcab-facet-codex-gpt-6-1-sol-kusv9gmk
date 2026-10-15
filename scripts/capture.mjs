/* global document */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://localhost:5173/");
await page.waitForTimeout(800);
await page.screenshot({ path: "showcase/title.png" });
const recording = await page.evaluate(async () => {
  const { createEngine, ConstantClock } =
    await import("/@fs/work/node_modules/@clockwyrks/simple-2d/dist/index.js");
  const { game, BACKGROUND } = await import("/src/game.ts");
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;z-index:10";
  document.body.append(canvas);
  const engine = createEngine({
    canvas,
    width: 1280,
    height: 720,
    game,
    background: BACKGROUND,
    clock: new ConstantClock(1000 / 30),
  });
  await engine.initialize();
  const d = engine.debug;
  const rows = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 8 }, (_, c) => "RACJBSM"[(r * 2 + c) % 7] + "0").join(
      " ",
    ),
  );
  engine.apply((s) => d.loadBoard(s, rows));
  engine.apply((s) => d.setScreen(s, "playing"));
  for (const [c, r, t] of [
    [0, 3, "R1"],
    [1, 3, "R2"],
    [2, 3, "A0"],
    [3, 3, "R0"],
    [2, 2, "R0"],
    [4, 3, "B3"],
    [5, 3, "S3"],
    [5, 4, "M0s"],
    [6, 6, "J1b"],
    [1, 6, "X0"],
  ])
    engine.apply((s) => d.setGem(s, c, r, t));
  for (let c = 0; c < 8; c++)
    engine.apply((s) =>
      d.setRefillKinds(
        s,
        c,
        "R" +
          Array.from(
            { length: 7 },
            (_, r) => "RACJBSM"[(c + r * 2 + 3) % 7],
          ).join(""),
      ),
    );
  await engine.advance(1);
  // A full engine recording; no animation or effect is reconstructed for the showcase.
  engine.startRecording();
  await engine.advance(12);
  engine.apply((s) => d.requestSwap(s, 2, 2, 2, 3));
  await engine.advance(6);
  engine.apply((s) => d.clearRefillKinds(s));
  await engine.advance(132);
  const rec = engine.stopRecording();
  engine.apply((s) => d.setGem(s, 6, 6, "J1b"));
  engine.apply((s) => d.setGem(s, 1, 6, "X0"));
  engine.apply((s) => d.setGem(s, 4, 4, "B3"));
  await engine.advance(1);
  return rec;
});
await page.screenshot({ path: "showcase/board.png" });
await writeFile("showcase/chain.json.gz", gzipSync(JSON.stringify(recording)));
await browser.close();
