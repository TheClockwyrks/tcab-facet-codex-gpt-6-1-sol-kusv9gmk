import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
export type GemKind =
  "ruby" | "amber" | "citrine" | "jade" | "beryl" | "sapphire" | "amethyst";

export type Cut = "plain" | "brilliant" | "star" | "prism";

export type Screen =
  "title" | "howto" | "playing" | "paused" | "levelclear" | "gameover";

export type Phase = "idle" | "swapping" | "resolving";

export type PointerDevice = "mouse" | "pen" | "touch";

export interface CellRef {
  readonly col: number;
  readonly row: number;
}

export interface GemState {
  readonly col: number;
  readonly row: number;
  readonly kind: GemKind | null;
  readonly cut: Cut;
  readonly strain: number;
  readonly fell: number;
}

export interface BoardState {
  readonly cols: number;
  readonly rows: number;
  readonly cells: readonly GemState[];
}

export interface RefusalState {
  readonly a: CellRef;
  readonly b: CellRef;
  readonly timer: number;
}

export interface PointerState {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
  readonly device: PointerDevice;
}

export interface FacetState {
  readonly screen: Screen;
  readonly menuIndex: number;

  readonly board: BoardState;
  readonly phase: Phase;
  readonly chainStep: number;
  readonly swapTimer: number;
  readonly stepTimer: number;

  readonly score: number;
  readonly level: number;
  readonly levelScore: number;
  readonly lastCleared: number;
  readonly lastPoints: number;
  readonly lastWaves: number;

  readonly moveScore: number;
  readonly bestMove: number;
  readonly bestChain: number;

  readonly selection: CellRef | null;
  readonly offer: CellRef | null;
  readonly refusal: RefusalState | null;
  readonly armedTarget: string | null;

  readonly pointer: PointerState;
  readonly simTime: number;
  readonly muted: boolean;
  readonly visual?: VisualState;
  readonly refillKinds: readonly string[];
}

export interface VisualState {
  readonly swap?: readonly CellRef[];
  readonly before?: readonly GemState[];
  readonly cleared?: readonly { gem: GemState; wave: number }[];
  readonly created?: readonly CellRef[];
  readonly dealAt?: number;
}
export type State = DeepReadonly<FacetState>;

import * as C from "./constants";
import { debug, snapshot } from "./debug";
import { action, pointer } from "./controls";
import { advance, initial } from "./simulation";
import { loadArt, render } from "./presentation";
export type FacetDebugApi = typeof debug;
export const BACKGROUND = "#06151e";
export const game: Game<FacetState, FacetDebugApi> = {
  async initialize(api) {
    for (const name of C.ACTIONS)
      api.input.register(name, { keys: [...C.BINDINGS[name]] });
    const cues = Object.values(C.CUES).map((cue) =>
      api.audio.load(cue, `audio/${cue === "clear" ? "shatter" : cue}.wav`),
    );
    await Promise.all([
      loadArt(api),
      ...cues,
      ...Array.from({ length: C.MAX_MULTIPLIER }, (_, i) =>
        api.audio.load(`ladder-${i + 1}`, `audio/ladder-${i + 1}.wav`),
      ),
      api.audio.load("theme-title", "audio/title.wav"),
      api.audio.load("theme-play", "audio/play.wav"),
    ]);
    const fields = [
      "screen",
      "phase",
      "score",
      "level",
      "levelScore",
      "levelTarget",
      "chainStep",
      "multiplier",
      "lastCleared",
      "lastPoints",
      "lastWaves",
      "lastFall",
      "bestMove",
      "bestChain",
      "legalSwap",
    ] as const;
    for (const field of fields)
      api.diagnostics.register(field, (s) => snapshot(s)[field]);
    api.diagnostics.register(
      "board",
      (s) => `${s.board.cols} × ${s.board.rows}`,
    );
    api.diagnostics.register("selection", (s) =>
      s.selection ? `${s.selection.col},${s.selection.row}` : "none",
    );
    api.diagnostics.register("offer", (s) =>
      s.offer ? `${s.offer.col},${s.offer.row}` : "none",
    );
    api.diagnostics.register(
      "pointer",
      (s) =>
        `${s.pointer.x.toFixed(0)},${s.pointer.y.toFixed(0)} ${s.pointer.device}`,
    );
    return [initial(), debug];
  },
  update(state, api, dt) {
    let next: FacetState = { ...state };
    const cues = new Set<string>();
    let clearRung = 1;
    if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
    for (const key of ["up", "down", "confirm", "back", "pause"])
      if (api.input.pressed(key)) next = action(next, key);
    for (const p of api.input.pointerSamples())
      if (p.primary && (p.type === "move" || p.button === "primary")) {
        const before = next;
        next = pointer(next, p.type, p.x, p.y, p.device);
        if (
          next.selection &&
          (next.selection.col !== before.selection?.col ||
            next.selection.row !== before.selection?.row)
        )
          cues.add(C.CUES.select);
        if (next.phase === "swapping" && before.phase !== "swapping")
          cues.add(C.CUES.swap);
        if (next.refusal !== before.refusal && next.refusal)
          cues.add(C.CUES.refuse);
      }
    const p = api.input.pointer();
    next = {
      ...next,
      pointer: {
        x: p.x,
        y: p.y,
        down: p.buttons.includes("primary"),
        device: p.device,
      },
      muted: api.audio.muted(),
    };
    next = advance(next, dt, (cue, multiplier) => {
      cues.add(cue);
      if (cue === C.CUES.clear) clearRung = multiplier ?? 1;
    });
    for (const cue of cues) {
      api.audio.play(cue);
      if (cue === C.CUES.clear) api.audio.play(`ladder-${clearRung}`);
    }
    const theme =
      next.screen === "title" || next.screen === "howto"
        ? "theme-title"
        : "theme-play";
    api.audio.stop(theme === "theme-title" ? "theme-play" : "theme-title");
    api.audio.loop(theme);
    return next;
  },
  render,
};
