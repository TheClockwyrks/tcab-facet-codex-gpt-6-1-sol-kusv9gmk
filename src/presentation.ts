import type { InitApi, RenderApi } from "@clockwyrks/simple-2d";
import {
  ParticleSimulator,
  type ParticleSystem,
} from "@clockwyrks/particle-runtime";
import type { FacetState, GemState, State } from "./game";
import * as C from "./constants";
import { cellX, cellY, index, lastFall, same } from "./simulation";
import { targets } from "./controls";

// Decoded assets are the only module-owned objects. Every animation samples state time.
const images = new Map<string, ImageBitmap>();
const systems = new Map<string, ParticleSystem>();
const imagePaths = [
  "gems/board.png",
  "gems/brilliant.png",
  "gems/star.png",
  ...[...C.GEM_KINDS, "prism"].flatMap((k) =>
    [0, 1, 2, 3].map((s) => `gems/${k}-${s}.png`),
  ),
  ...C.GEM_KINDS.flatMap((k) =>
    Array.from({ length: 6 }, (_, i) => `gems/break/${k}/${i}.png`),
  ),
  ...Array.from({ length: 8 }, (_, i) => `gems/prism-turn/${i}.png`),
];
export async function loadArt(api: InitApi<FacetState>) {
  await Promise.all([
    ...imagePaths.map(async (p) =>
      images.set(p, await api.assets.loadImage(p)),
    ),
    ...["clear", "flaw", "cut", "aura"].map(async (name) =>
      systems.set(
        name,
        JSON.parse(
          await (await api.assets.load(`fx/${name}/system.json`)).text(),
        ) as ParticleSystem,
      ),
    ),
  ]);
}
const ink = "#e8e8d9",
  gold = "#c5ae7c",
  dim = "#7d9a9f";
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 16,
  color = ink,
  font = "sans-serif",
  align: CanvasTextAlign = "left",
) {
  ctx.fillStyle = color;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function rule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color = "#29434a",
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
}
function sprite(
  ctx: CanvasRenderingContext2D,
  p: string,
  x: number,
  y: number,
  w = 64,
  h = w,
) {
  const image = images.get(p);
  if (image) ctx.drawImage(image, Math.round(x), Math.round(y), w, h);
}
function gem(
  ctx: CanvasRenderingContext2D,
  g: GemState,
  x: number,
  y: number,
  time: number,
  size = 64,
) {
  const name = g.kind ?? "prism";
  sprite(ctx, `gems/${name}-${g.strain}.png`, x - size / 2, y - size / 2, size);
  if (g.cut === "prism") {
    ctx.save();
    ctx.globalAlpha = g.strain === 0 ? 1 : 0.36;
    sprite(
      ctx,
      `gems/prism-turn/${Math.floor(time * 9) % 8}.png`,
      x - size / 2,
      y - size / 2,
      size,
    );
    ctx.restore();
  }
  if (g.cut === "brilliant" || g.cut === "star")
    sprite(ctx, `gems/${g.cut}.png`, x - size / 2, y - size / 2, size);
}
function particles(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  age: number,
  seed: number,
) {
  const system = systems.get(name);
  if (!system || age < 0 || age > 1.3) return;
  const sim = new ParticleSimulator(system, { seed, maxParticles: 64 });
  // Integrate at a stable timestep. Rendering can be repeated or sought without advancing the game.
  for (let t = 0; t < age; t += 1 / 60)
    sim.step(Math.min(1 / 60, age - t) * 1000);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of sim.capture()) {
    const r = p.size * (name === "aura" ? 1.2 : 1.5);
    if (r <= 0) continue;
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = `rgb(${p.color.map((v) => Math.round(v * 255)).join(",")})`;
    ctx.beginPath();
    ctx.arc(x + p.position[0], y - p.position[1], r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function background(ctx: CanvasRenderingContext2D, time: number) {
  const gradient = ctx.createRadialGradient(640, 340, 50, 640, 360, 780);
  gradient.addColorStop(0, "#16343d");
  gradient.addColorStop(0.58, "#0b222c");
  gradient.addColorStop(1, "#06151e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  // Engraved radial geometry, kept subtle so the stones remain the lit subject.
  ctx.strokeStyle = "#28414a";
  ctx.lineWidth = 0.7;
  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(640 + Math.cos(a) * 280, 360 + Math.sin(a) * 280);
    ctx.lineTo(640 + Math.cos(a) * 800, 360 + Math.sin(a) * 800);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  rule(ctx, 40, 25, 1200);
  rule(ctx, 40, 694, 1200);
  text(ctx, "F /", 48, 60, 22, gold, "Georgia");
  text(ctx, "THE LAPIDARY COLLECTION", 92, 57, 11, dim);
  text(ctx, "01  /  FACET", 1230, 57, 11, dim, "monospace", "right");
  for (let i = 0; i < 17; i++) {
    ctx.fillStyle = i % 3 ? "#42616b" : "#a29069";
    ctx.globalAlpha = 0.1 + 0.15 * (1 + Math.sin(time * 0.5 + i));
    ctx.fillRect(70 + ((i * 173) % 1140), 100 + ((i * 97) % 550), 1, 1);
  }
  ctx.globalAlpha = 1;
}
function board(ctx: CanvasRenderingContext2D, s: State) {
  sprite(ctx, "gems/board.png", 336, 92, 608);
  const shatter = s.lastWaves * C.WAVE_SECONDS;
  const cleared = s.visual?.cleared ?? [];
  const time = s.simTime;
  ctx.save();
  ctx.beginPath();
  ctx.rect(351, 108, 578, 576);
  ctx.clip();
  const holding = s.phase === "resolving" && s.stepTimer < shatter;
  const visible = holding
    ? (s.visual?.before ?? s.board.cells).filter(
        (g) => !cleared.some((c) => same(c.gem, g)),
      )
    : s.board.cells;
  for (const g of visible) {
    let x = cellX(g.col),
      y = cellY(g.row);
    if (s.offer && s.selection) {
      if (same(g, s.selection)) {
        x = cellX(s.offer.col);
        y = cellY(s.offer.row);
      } else if (same(g, s.offer)) {
        x = cellX(s.selection.col);
        y = cellY(s.selection.row);
      }
    }
    if (s.phase === "swapping" && s.visual?.swap) {
      const [a, b] = s.visual.swap;
      const from = same(g, a) ? b : same(g, b) ? a : null;
      if (from) {
        const p = Math.min(1, s.swapTimer / C.SWAP_SECONDS);
        const ease = p * p * (3 - 2 * p);
        x = cellX(from.col) + (x - cellX(from.col)) * ease;
        y = cellY(from.row) + (y - cellY(from.row)) * ease;
      }
    }
    if (s.phase === "resolving" && !holding) {
      y -=
        Math.max(0, g.fell - (s.stepTimer - shatter) / C.FALL_SECONDS_PER_ROW) *
        C.CELL_PITCH;
    } else if (s.visual?.dealAt !== undefined) {
      const elapsed = s.simTime - s.visual.dealAt;
      y -=
        Math.max(0, g.fell - elapsed / C.FALL_SECONDS_PER_ROW) * C.CELL_PITCH;
    }
    gem(ctx, g, x, y, time);
    if (g.cut !== "plain")
      particles(
        ctx,
        "aura",
        x,
        y,
        0.5 + ((time + index(g) * 0.09) % 0.6),
        Math.floor(time / 1.2) + index(g),
      );
  }
  if (s.phase === "resolving") {
    for (const { gem: g, wave } of cleared) {
      const age = s.stepTimer - wave * C.WAVE_SECONDS,
        x = cellX(g.col),
        y = cellY(g.row);
      if (age < 0) gem(ctx, g, x, y, time);
      else if (age < 0.24 && g.kind)
        sprite(
          ctx,
          `gems/break/${g.kind}/${Math.min(5, Math.floor(age / 0.04))}.png`,
          x - 32,
          y - 32,
        );
      particles(
        ctx,
        g.strain === C.MAX_STRAIN ? "flaw" : "clear",
        x,
        y,
        age,
        index(g) + Math.floor(time - s.stepTimer) * 97,
      );
    }
    for (const p of s.visual?.created ?? [])
      particles(
        ctx,
        "cut",
        cellX(p.col),
        cellY(p.row),
        s.stepTimer - shatter,
        index(p),
      );
  }
  ctx.restore();
  if (s.selection) {
    const x = cellX(s.selection.col),
      y = cellY(s.selection.row);
    ctx.strokeStyle = "#f5e4b0";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 33, y - 33, 66, 66);
    ctx.fillStyle = gold;
    for (const dx of [-1, 1])
      for (const dy of [-1, 1])
        ctx.fillRect(x + dx * 33 - 2, y + dy * 33 - 2, 4, 4);
  }
  if (s.refusal)
    for (const p of [s.refusal.a, s.refusal.b]) {
      ctx.strokeStyle = "#ef967e";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        cellX(p.col) - 32 + Math.sin(s.refusal.timer * 65) * 2,
        cellY(p.row) - 32,
        64,
        64,
      );
    }
}
function buttons(
  ctx: CanvasRenderingContext2D,
  s: State,
  items: readonly string[],
) {
  for (const t of targets(s)) {
    const i = Number(t.id.slice(5)),
      active = s.menuIndex === i;
    ctx.fillStyle = active ? "#c6ad78" : "#102b35";
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.strokeStyle = active ? "#ecdbaf" : "#3a545a";
    ctx.lineWidth = 1;
    ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1);
    text(
      ctx,
      items[i],
      t.x + t.w / 2,
      t.y + 44,
      17,
      active ? "#10232b" : ink,
      "sans-serif",
      "center",
    );
    if (active) text(ctx, "›", t.x + 24, t.y + 45, 25, "#10232b", "Georgia");
  }
}
function utility(ctx: CanvasRenderingContext2D, s: State) {
  const t = targets(s)[0];
  ctx.strokeStyle = "#496067";
  ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1);
  text(
    ctx,
    s.screen === "playing" ? C.PAUSE_LABEL : C.BACK_LABEL,
    t.x + t.w / 2,
    t.y + 43,
    13,
    gold,
    "sans-serif",
    "center",
  );
}
function wrapped(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  size = 17,
  color = dim,
  lineHeight = 27,
) {
  ctx.font = `${size}px sans-serif`;
  let line = "";
  for (const word of value.split(" ")) {
    if (ctx.measureText(line + word).width > width) {
      text(ctx, line, x, y, size, color);
      y += lineHeight;
      line = "";
    }
    line += word + " ";
  }
  if (line) text(ctx, line, x, y, size, color);
  return y + lineHeight;
}
function hud(ctx: CanvasRenderingContext2D, s: State) {
  text(ctx, C.TITLE_TEXT, 65, 162, 43, ink, "Georgia");
  text(ctx, "PRESSURE / POSSIBILITY", 68, 189, 10, gold);
  rule(ctx, 68, 218, 208);
  text(ctx, C.HUD_SCORE_LABEL, 68, 259, 12, dim);
  text(ctx, s.score.toLocaleString(), 65, 310, 42, ink, "Georgia");
  text(
    ctx,
    C.HUD_LEVEL_LABEL + "  " + String(s.level).padStart(2, "0"),
    68,
    358,
    13,
    gold,
  );
  text(
    ctx,
    `${s.levelScore.toLocaleString()} / ${(s.level * C.LEVEL_TARGET_STEP).toLocaleString()}`,
    68,
    387,
    14,
    dim,
    "monospace",
  );
  ctx.fillStyle = "#233e47";
  ctx.fillRect(68, 408, 208, 5);
  ctx.fillStyle = gold;
  ctx.fillRect(
    68,
    408,
    208 * Math.min(1, s.levelScore / (s.level * C.LEVEL_TARGET_STEP)),
    5,
  );
  if (s.phase === "resolving") {
    text(ctx, C.HUD_CHAIN_LABEL, 68, 473, 12, dim);
    text(
      ctx,
      `×${Math.min(s.chainStep, C.MAX_MULTIPLIER)}`,
      65,
      535,
      55,
      gold,
      "Georgia",
    );
    text(ctx, `+${s.lastPoints}  /  ${s.lastCleared} stones`, 68, 566, 13, dim);
  } else {
    wrapped(
      ctx,
      "Every fracture is a future possibility.",
      68,
      475,
      200,
      19,
      gold,
      29,
    );
  }
  text(ctx, "THE ART OF LETTING GO", 992, 194, 11, gold);
  rule(ctx, 992, 216, 224);
  text(ctx, "Make a little", 992, 252, 24, ink, "Georgia");
  text(ctx, "pressure.", 992, 284, 24, ink, "Georgia");
  wrapped(
    ctx,
    "Swap neighbors. Line up three. Let the fractures do the rest.",
    992,
    322,
    210,
    15,
    dim,
    24,
  );
  for (let i = 0; i < 4; i++)
    sprite(ctx, `gems/beryl-${i}.png`, 986 + i * 53, 421, 48);
  text(ctx, "CLEAN", 992, 493, 10, dim);
  text(ctx, "FLAWED / 2×", 1208, 493, 10, gold, "sans-serif", "right");
  wrapped(
    ctx,
    "A flawed stone joins any clear beside it.",
    992,
    529,
    210,
    15,
    dim,
    24,
  );
  rule(ctx, 992, 590, 224);
  text(ctx, "DRAG OR TAP TWO GEMS", 992, 619, 11, gold);
  text(
    ctx,
    `M  SOUND ${s.muted ? "OFF" : "ON"}     P  PAUSE`,
    992,
    646,
    11,
    dim,
    "monospace",
  );
}
export function render(s: State, api: RenderApi) {
  const ctx = api.ctx;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  background(ctx, s.simTime);
  if (s.screen === "playing") {
    board(ctx, s);
    hud(ctx, s);
    utility(ctx, s);
  } else if (s.screen === "title") {
    // A jeweler's specimen arrangement, independent of any playable board.
    const kinds = ["sapphire", "jade", "ruby", "amber", "amethyst"] as const;
    kinds.forEach((kind, i) => {
      const a = (i - 2) * 0.45;
      const x = 640 + Math.sin(a) * 220,
        y = 192 + (1 - Math.cos(a)) * 75;
      gem(
        ctx,
        { col: 0, row: 0, kind, cut: "plain", strain: 0, fell: 0 },
        x,
        y,
        s.simTime,
        i === 2 ? 96 : 64,
      );
    });
    text(
      ctx,
      "A GAME OF STONES & CONSEQUENCES",
      640,
      116,
      11,
      gold,
      "sans-serif",
      "center",
    );
    text(ctx, C.TITLE_TEXT, 648, 325, 94, ink, "Georgia", "center");
    text(ctx, C.TAGLINE_TEXT, 640, 369, 14, gold, "sans-serif", "center");
    buttons(ctx, s, C.TITLE_ITEMS);
    text(
      ctx,
      "TAKE YOUR TIME. FIND YOUR CHAIN.",
      640,
      652,
      11,
      dim,
      "sans-serif",
      "center",
    );
  } else if (s.screen === "howto") {
    text(ctx, "The art of pressure", 68, 143, 52, ink, "Georgia");
    text(ctx, "HOW TO PLAY", 69, 181, 12, gold);
    utility(ctx, s);
    const paragraphs = [
      [
        "01 / TAKE HOLD",
        "Seven kinds of stone. Take a gem with a mouse, pen, or finger, carry it onto a neighbor, then let go. You can also tap a gem, then tap its neighbor. Carry it back before releasing to cancel.",
      ],
      [
        "02 / FIND THE LINE",
        "Three or more of one kind shatter. A swap that shatters nothing is refused. Stones fall into the gaps and can shatter again; each step of the chain scores more, up to ×8.",
      ],
      [
        "03 / SPEND THE STRAIN",
        "Every clear strains the stones beside it. Three strains leave a stone flawed. A flawed stone joins any clear that touches it, carries the chain onward, and scores double.",
      ],
      [
        "04 / EARN A BETTER CUT",
        "Four in a line leave a brilliant that clears its surrounding ring. Five or more leave a prism: swap it with a gem to clear that kind. Crossing lines leave a star that clears its whole row and column.",
      ],
      [
        "05 / KEEP GOING",
        "Reach the level target to continue to a fresh board. Your score carries on. The round ends when no productive swap remains. There is no clock to race.",
      ],
      [
        "06 / AT YOUR FINGERTIPS",
        "Every menu answers the pointer. ↑ / ↓ choose, Enter or Space confirms. P or Escape pauses and resumes. Escape returns from this page or the final board. M toggles all sound.",
      ],
    ];
    paragraphs.forEach(([title, body], i) => {
      const x = 68 + (i % 3) * 400,
        y = 249 + Math.floor(i / 3) * 210;
      text(ctx, title, x, y, 12, gold);
      rule(ctx, x, y + 17, 344);
      wrapped(ctx, body, x, y + 49, 340, 16, ink, 25);
    });
  } else {
    board(ctx, s);
    hud(ctx, s);
    ctx.fillStyle = "#06151ee8";
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
    const heading =
      s.screen === "paused"
        ? C.PAUSED_TITLE_TEXT
        : s.screen === "levelclear"
          ? C.LEVELCLEAR_TITLE_TEXT
          : C.GAMEOVER_TITLE_TEXT;
    text(
      ctx,
      "THE LAPIDARY / " + String(s.level).padStart(2, "0"),
      640,
      222,
      12,
      gold,
      "sans-serif",
      "center",
    );
    text(ctx, heading, 640, 294, 56, ink, "Georgia", "center");
    if (s.screen === "paused")
      text(
        ctx,
        "The stones will wait.",
        640,
        350,
        20,
        dim,
        "Georgia",
        "center",
      );
    else if (s.screen === "levelclear") {
      text(
        ctx,
        `${C.BEST_CHAIN_LABEL}  ${s.bestChain}     /     ${C.BEST_MOVE_LABEL}  ${s.bestMove}`,
        640,
        355,
        14,
        gold,
        "sans-serif",
        "center",
      );
    } else
      text(
        ctx,
        `${C.HUD_SCORE_LABEL}  ${s.score.toLocaleString()}     /     ${C.HUD_LEVEL_LABEL}  ${s.level}`,
        640,
        355,
        16,
        gold,
        "sans-serif",
        "center",
      );
    buttons(
      ctx,
      s,
      s.screen === "paused"
        ? C.PAUSED_ITEMS
        : s.screen === "levelclear"
          ? C.LEVELCLEAR_ITEMS
          : C.GAMEOVER_ITEMS,
    );
  }
  text(ctx, "FACET  /  PRESSURE FINDS THE FLAW", 48, 714, 9, dim);
  text(
    ctx,
    "ORIGINAL STONES · ORIGINAL SOUND",
    1232,
    714,
    9,
    dim,
    "sans-serif",
    "right",
  );
  ctx.restore();
}
export const maximumFall = lastFall;
