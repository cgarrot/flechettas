import type {
  AroundTheClockConfig,
  Bobs27Config,
  Checkout121Config,
  CricketConfig,
  GameConfig,
  GameMode,
  KillerConfig,
  ShanghaiConfig,
  TrainingConfig,
  X01Config,
} from "@/types";

export const modeMessageKeys = {
  x01: "x01",
  cricket: "cricket",
  "around-the-clock": "aroundTheClock",
  "bobs-27": "bobs27",
  "checkout-121": "checkout121",
  shanghai: "shanghai",
  training: "training",
  killer: "killer",
} as const satisfies Record<GameMode, string>;

export const GAME_PRESETS = [
  { id: "x01-501-classic", mode: "x01" },
  { id: "x01-301-open", mode: "x01" },
  { id: "x01-501-double-out", mode: "x01" },
  { id: "x01-501-master-out", mode: "x01" },
  { id: "x01-701-league", mode: "x01" },
  { id: "x01-double-in", mode: "x01" },
  { id: "cricket-standard", mode: "cricket" },
  { id: "cricket-cut-throat", mode: "cricket" },
  { id: "cricket-no-score", mode: "cricket" },
  { id: "cricket-race-50", mode: "cricket" },
  { id: "around-open", mode: "around-the-clock" },
  { id: "around-doubles", mode: "around-the-clock" },
  { id: "around-triples", mode: "around-the-clock" },
  { id: "around-bull-finish", mode: "around-the-clock" },
  { id: "bobs-27-classic", mode: "bobs-27" },
  { id: "bobs-27-survival", mode: "bobs-27" },
  { id: "checkout-121-three", mode: "checkout-121" },
  { id: "checkout-121-six", mode: "checkout-121" },
  { id: "checkout-121-ladder", mode: "checkout-121" },
  { id: "shanghai-classic", mode: "shanghai" },
  { id: "shanghai-marathon", mode: "shanghai" },
  { id: "training-singles", mode: "training" },
  { id: "training-doubles", mode: "training" },
  { id: "training-scoring", mode: "training" },
  { id: "training-checkout", mode: "training" },
  { id: "training-cricket", mode: "training" },
  { id: "killer-classic", mode: "killer" },
  { id: "killer-random", mode: "killer" },
  { id: "killer-first-hit", mode: "killer" },
  { id: "killer-shared", mode: "killer" },
] as const satisfies readonly Readonly<{
  id: string;
  mode: GameMode;
}>[];

export type GamePreset = (typeof GAME_PRESETS)[number];
export type GamePresetId = GamePreset["id"];

function assertNever(value: never): never {
  throw new Error(`Unhandled game preset: ${value}`);
}

function x01Config(config: GameConfig): X01Config {
  if (config.mode !== "x01") {
    throw new Error("Expected X01 config.");
  }

  return config;
}

function cricketConfig(config: GameConfig): CricketConfig {
  if (config.mode !== "cricket") {
    throw new Error("Expected Cricket config.");
  }

  return config;
}

function aroundTheClockConfig(config: GameConfig): AroundTheClockConfig {
  if (config.mode !== "around-the-clock") {
    throw new Error("Expected Around the Clock config.");
  }

  return config;
}

function bobs27Config(config: GameConfig): Bobs27Config {
  if (config.mode !== "bobs-27") {
    throw new Error("Expected Bob's 27 config.");
  }

  return config;
}

function checkout121Config(config: GameConfig): Checkout121Config {
  if (config.mode !== "checkout-121") {
    throw new Error("Expected Checkout 121 config.");
  }

  return config;
}

function shanghaiConfig(config: GameConfig): ShanghaiConfig {
  if (config.mode !== "shanghai") {
    throw new Error("Expected Shanghai config.");
  }

  return config;
}

function trainingConfig(config: GameConfig): TrainingConfig {
  if (config.mode !== "training") {
    throw new Error("Expected Training config.");
  }

  return config;
}

function killerConfig(config: GameConfig): KillerConfig {
  if (config.mode !== "killer") {
    throw new Error("Expected Killer config.");
  }

  return config;
}

export function isGamePresetId(value: unknown): value is GamePresetId {
  return typeof value === "string" && GAME_PRESETS.some((preset) => preset.id === value);
}

export function firstPresetIdForMode(mode: GameMode): GamePresetId {
  return GAME_PRESETS.find((preset) => preset.mode === mode)?.id ?? GAME_PRESETS[0].id;
}

export function createGamePresetConfig(
  presetId: GamePresetId,
  currentConfig: GameConfig,
): GameConfig {
  switch (presetId) {
    case "x01-301-open":
      return { ...x01Config(currentConfig), startingScore: 301, doubleIn: false, doubleOut: false, masterOut: false };
    case "x01-501-classic":
      return { ...x01Config(currentConfig), startingScore: 501, doubleIn: false, doubleOut: false, masterOut: false };
    case "x01-501-double-out":
      return { ...x01Config(currentConfig), startingScore: 501, doubleIn: false, doubleOut: true, masterOut: false };
    case "x01-501-master-out":
      return { ...x01Config(currentConfig), startingScore: 501, doubleIn: false, doubleOut: false, masterOut: true };
    case "x01-701-league":
      return { ...x01Config(currentConfig), startingScore: 701, doubleIn: false, doubleOut: true, masterOut: false };
    case "x01-double-in":
      return { ...x01Config(currentConfig), startingScore: 501, doubleIn: true, doubleOut: true, masterOut: false };
    case "cricket-standard":
      return { ...cricketConfig(currentConfig), variant: "standard", scorePoints: true, pointsRequiredToWin: undefined };
    case "cricket-cut-throat":
      return { ...cricketConfig(currentConfig), variant: "cut-throat", scorePoints: true, pointsRequiredToWin: undefined };
    case "cricket-no-score":
      return { ...cricketConfig(currentConfig), variant: "no-score", scorePoints: false, pointsRequiredToWin: undefined };
    case "cricket-race-50":
      return { ...cricketConfig(currentConfig), variant: "standard", scorePoints: true, pointsRequiredToWin: 50 };
    case "around-open":
      return { ...aroundTheClockConfig(currentConfig), startSegment: 1, endSegment: 20, requiredMultiplier: "open", includeBull: false };
    case "around-doubles":
      return { ...aroundTheClockConfig(currentConfig), startSegment: 1, endSegment: 20, requiredMultiplier: 2, includeBull: false };
    case "around-triples":
      return { ...aroundTheClockConfig(currentConfig), startSegment: 1, endSegment: 20, requiredMultiplier: 3, includeBull: false };
    case "around-bull-finish":
      return { ...aroundTheClockConfig(currentConfig), startSegment: 1, endSegment: 25, requiredMultiplier: "open", includeBull: true };
    case "bobs-27-classic":
      return { ...bobs27Config(currentConfig), allowNegativeScore: false };
    case "bobs-27-survival":
      return { ...bobs27Config(currentConfig), allowNegativeScore: true };
    case "checkout-121-three":
      return { ...checkout121Config(currentConfig), dartsPerTarget: 3, failureStep: 1, successStep: 1 };
    case "checkout-121-six":
      return { ...checkout121Config(currentConfig), dartsPerTarget: 6, failureStep: 1, successStep: 1 };
    case "checkout-121-ladder":
      return { ...checkout121Config(currentConfig), dartsPerTarget: 3, failureStep: 2, successStep: 3 };
    case "shanghai-classic":
      return { ...shanghaiConfig(currentConfig), instantShanghaiWin: true };
    case "shanghai-marathon":
      return { ...shanghaiConfig(currentConfig), instantShanghaiWin: false };
    case "training-singles":
      return { ...trainingConfig(currentConfig), focus: "singles", rounds: 5, hitsRequiredToAdvance: 1 };
    case "training-doubles":
      return { ...trainingConfig(currentConfig), focus: "doubles", rounds: 5, hitsRequiredToAdvance: 1 };
    case "training-scoring":
      return { ...trainingConfig(currentConfig), focus: "scoring", rounds: 10, hitsRequiredToAdvance: 1 };
    case "training-checkout":
      return { ...trainingConfig(currentConfig), focus: "checkout", rounds: 5, hitsRequiredToAdvance: 1 };
    case "training-cricket":
      return { ...trainingConfig(currentConfig), focus: "cricket", rounds: 7, hitsRequiredToAdvance: 2 };
    case "killer-classic":
      return { ...killerConfig(currentConfig), startingLives: 3, assignment: "sequential", requiredHitsToBecomeKiller: 1, allowSharedNumbers: false };
    case "killer-random":
      return { ...killerConfig(currentConfig), startingLives: 3, assignment: "random", requiredHitsToBecomeKiller: 1, allowSharedNumbers: false };
    case "killer-first-hit":
      return { ...killerConfig(currentConfig), startingLives: 3, assignment: "first-hit", requiredHitsToBecomeKiller: 1, allowSharedNumbers: false };
    case "killer-shared":
      return { ...killerConfig(currentConfig), startingLives: 5, assignment: "random", requiredHitsToBecomeKiller: 2, allowSharedNumbers: true };
    default:
      return assertNever(presetId);
  }
}
