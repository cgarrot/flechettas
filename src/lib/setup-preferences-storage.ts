import type {
  GameConfig,
  GameMode,
  KillerAssignment,
  MatchFormat,
  Multiplier,
  NumberSegment,
  PlayerDef,
  TrainingFocus,
  X01StartScore,
} from "@/types";

const SETUP_PREFERENCES_VERSION = 1;
const SETUP_PREFERENCES_STORAGE_KEY = "flechettas.setupPreferences.v1";

const GAME_MODES = [
  "x01",
  "cricket",
  "around-the-clock",
  "bobs-27",
  "checkout-121",
  "shanghai",
  "training",
  "killer",
] as const satisfies readonly GameMode[];

const X01_START_SCORES = [301, 501, 701] as const satisfies readonly X01StartScore[];
const NUMBER_SEGMENTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const satisfies readonly NumberSegment[];
const REQUIRED_MULTIPLIERS = ["open", 1, 2, 3] as const satisfies readonly (Multiplier | "open")[];
const CHECKOUT_DARTS = [3, 6, 9] as const;
const HITS_REQUIRED_TO_ADVANCE = [1, 2, 3] as const;
const TRAINING_FOCUSES = [
  "singles",
  "doubles",
  "scoring",
  "checkout",
  "cricket",
  "custom",
] as const satisfies readonly TrainingFocus[];
const KILLER_ASSIGNMENTS = [
  "sequential",
  "manual",
  "first-hit",
  "random",
] as const satisfies readonly KillerAssignment[];

type PersistedBaseConfig<TMode extends GameMode> = Readonly<{
  mode: TMode;
  matchFormat?: MatchFormat;
}>;

type PersistedGameConfig =
  | (PersistedBaseConfig<"x01"> & Readonly<{
    startingScore: X01StartScore;
    doubleIn?: boolean;
    doubleOut: boolean;
    masterOut?: boolean;
  }>)
  | (PersistedBaseConfig<"cricket"> & Readonly<{
    variant: "standard" | "cut-throat" | "no-score";
    scorePoints: boolean;
    pointsRequiredToWin?: number;
  }>)
  | (PersistedBaseConfig<"around-the-clock"> & Readonly<{
    startSegment: NumberSegment;
    endSegment: NumberSegment | 25;
    requiredMultiplier?: Multiplier | "open";
    includeBull?: boolean;
  }>)
  | (PersistedBaseConfig<"bobs-27"> & Readonly<{
    allowNegativeScore?: boolean;
  }>)
  | (PersistedBaseConfig<"checkout-121"> & Readonly<{
    dartsPerTarget: 3 | 6 | 9;
    failureStep: number;
    successStep: number;
  }>)
  | (PersistedBaseConfig<"shanghai"> & Readonly<{
    instantShanghaiWin: boolean;
  }>)
  | (PersistedBaseConfig<"training"> & Readonly<{
    focus: TrainingFocus;
    rounds?: number;
    hitsRequiredToAdvance?: 1 | 2 | 3;
  }>)
  | (PersistedBaseConfig<"killer"> & Readonly<{
    startingLives: number;
    assignment: KillerAssignment;
    requiredHitsToBecomeKiller: number;
    allowSharedNumbers?: boolean;
  }>);

type StoredSetupPreferences = Readonly<{
  version: typeof SETUP_PREFERENCES_VERSION;
  selectedMode: GameMode;
  configs: Record<GameMode, PersistedGameConfig>;
}>;

export type SetupPreferences = Readonly<{
  selectedMode: GameMode;
  configs: Record<GameMode, GameConfig>;
}>;

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGameMode(value: unknown): value is GameMode {
  return GAME_MODES.some((mode) => mode === value);
}

function readInteger(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = source?.[key];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function readOptionalInteger(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback: number | undefined,
  min: number,
  max: number,
): number | undefined {
  const value = source?.[key];

  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function readBoolean(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const value = source?.[key];

  return typeof value === "boolean" ? value : fallback;
}

function readOptionalBoolean(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean | undefined,
): boolean | undefined {
  const value = source?.[key];

  if (value === undefined) {
    return fallback;
  }

  return typeof value === "boolean" ? value : fallback;
}

function readOneOf<TValue extends string | number>(
  source: Record<string, unknown> | undefined,
  key: string,
  options: readonly TValue[],
  fallback: TValue,
): TValue {
  const value = source?.[key];

  for (const option of options) {
    if (value === option) {
      return option;
    }
  }

  return fallback;
}

function sourceForMode(source: unknown, mode: GameMode): Record<string, unknown> | undefined {
  if (!isRecord(source) || source.mode !== mode) {
    return undefined;
  }

  return source;
}

function serializeMatchFormat(matchFormat: MatchFormat | undefined): MatchFormat | undefined {
  if (!matchFormat) {
    return undefined;
  }

  const serialized: MatchFormat = {
    legsToWin: matchFormat.legsToWin,
  };

  if (matchFormat.setsToWin !== undefined) {
    serialized.setsToWin = matchFormat.setsToWin;
  }

  if (matchFormat.winByTwoLegs !== undefined) {
    serialized.winByTwoLegs = matchFormat.winByTwoLegs;
  }

  return serialized;
}

function readMatchFormat(
  source: Record<string, unknown> | undefined,
  fallback: MatchFormat | undefined,
): MatchFormat {
  const sourceMatchFormat = isRecord(source?.matchFormat) ? source.matchFormat : undefined;
  const matchFormat: MatchFormat = {
    legsToWin: readInteger(sourceMatchFormat, "legsToWin", fallback?.legsToWin ?? 1, 1, 99),
  };
  const setsToWin = readOptionalInteger(sourceMatchFormat, "setsToWin", fallback?.setsToWin, 1, 25);
  const winByTwoLegs = readOptionalBoolean(sourceMatchFormat, "winByTwoLegs", fallback?.winByTwoLegs);

  if (setsToWin !== undefined) {
    matchFormat.setsToWin = setsToWin;
  }

  if (winByTwoLegs !== undefined) {
    matchFormat.winByTwoLegs = winByTwoLegs;
  }

  return matchFormat;
}

function serializeConfig(config: GameConfig): PersistedGameConfig {
  const matchFormat = serializeMatchFormat(config.matchFormat);

  switch (config.mode) {
    case "x01":
      return {
        mode: "x01",
        matchFormat,
        startingScore: config.startingScore,
        doubleIn: config.doubleIn,
        doubleOut: config.doubleOut,
        masterOut: config.masterOut,
      };
    case "cricket":
      return {
        mode: "cricket",
        matchFormat,
        variant: config.variant,
        scorePoints: config.scorePoints,
        pointsRequiredToWin: config.pointsRequiredToWin,
      };
    case "around-the-clock":
      return {
        mode: "around-the-clock",
        matchFormat,
        startSegment: config.startSegment,
        endSegment: config.endSegment,
        requiredMultiplier: config.requiredMultiplier,
        includeBull: config.includeBull,
      };
    case "bobs-27":
      return {
        mode: "bobs-27",
        matchFormat,
        allowNegativeScore: config.allowNegativeScore,
      };
    case "checkout-121":
      return {
        mode: "checkout-121",
        matchFormat,
        dartsPerTarget: config.dartsPerTarget,
        failureStep: config.failureStep,
        successStep: config.successStep,
      };
    case "shanghai":
      return {
        mode: "shanghai",
        matchFormat,
        instantShanghaiWin: config.instantShanghaiWin,
      };
    case "training":
      return {
        mode: "training",
        matchFormat,
        focus: config.focus,
        rounds: config.rounds,
        hitsRequiredToAdvance: config.hitsRequiredToAdvance,
      };
    case "killer":
      return {
        mode: "killer",
        matchFormat,
        startingLives: config.startingLives,
        assignment: config.assignment,
        requiredHitsToBecomeKiller: config.requiredHitsToBecomeKiller,
        allowSharedNumbers: config.allowSharedNumbers,
      };
  }
}

function serializeConfigs(configs: Record<GameMode, GameConfig>): Record<GameMode, PersistedGameConfig> {
  return {
    x01: serializeConfig(configs.x01),
    cricket: serializeConfig(configs.cricket),
    "around-the-clock": serializeConfig(configs["around-the-clock"]),
    "bobs-27": serializeConfig(configs["bobs-27"]),
    "checkout-121": serializeConfig(configs["checkout-121"]),
    shanghai: serializeConfig(configs.shanghai),
    training: serializeConfig(configs.training),
    killer: serializeConfig(configs.killer),
  };
}

function parseConfig(source: unknown, fallback: GameConfig): GameConfig {
  const sourceRecord = sourceForMode(source, fallback.mode);
  const matchFormat = readMatchFormat(sourceRecord, fallback.matchFormat);
  const players: readonly PlayerDef[] = [];

  switch (fallback.mode) {
    case "x01":
      return {
        mode: "x01",
        players,
        matchFormat,
        startingScore: readOneOf(sourceRecord, "startingScore", X01_START_SCORES, fallback.startingScore),
        doubleIn: readBoolean(sourceRecord, "doubleIn", fallback.doubleIn ?? false),
        doubleOut: readBoolean(sourceRecord, "doubleOut", fallback.doubleOut),
        masterOut: readBoolean(sourceRecord, "masterOut", fallback.masterOut ?? false),
      };
    case "cricket":
      return {
        mode: "cricket",
        players,
        matchFormat,
        variant: readOneOf(sourceRecord, "variant", ["standard", "cut-throat", "no-score"], fallback.variant),
        targets: fallback.targets,
        scorePoints: readBoolean(sourceRecord, "scorePoints", fallback.scorePoints),
        pointsRequiredToWin: readOptionalInteger(sourceRecord, "pointsRequiredToWin", fallback.pointsRequiredToWin, 0, 999),
      };
    case "around-the-clock":
      return {
        mode: "around-the-clock",
        players,
        matchFormat,
        startSegment: readOneOf(sourceRecord, "startSegment", NUMBER_SEGMENTS, fallback.startSegment),
        endSegment: readOneOf(sourceRecord, "endSegment", [...NUMBER_SEGMENTS, 25], fallback.endSegment),
        requiredMultiplier: readOneOf(sourceRecord, "requiredMultiplier", REQUIRED_MULTIPLIERS, fallback.requiredMultiplier ?? "open"),
        includeBull: readBoolean(sourceRecord, "includeBull", fallback.includeBull ?? true),
      };
    case "bobs-27":
      return {
        mode: "bobs-27",
        players,
        matchFormat,
        startingScore: 27,
        doublesOnly: true,
        rounds: fallback.rounds,
        allowNegativeScore: readBoolean(sourceRecord, "allowNegativeScore", fallback.allowNegativeScore ?? false),
      };
    case "checkout-121":
      return {
        mode: "checkout-121",
        players,
        matchFormat,
        startingTarget: 121,
        minimumTarget: fallback.minimumTarget,
        maximumTarget: fallback.maximumTarget,
        dartsPerTarget: readOneOf(sourceRecord, "dartsPerTarget", CHECKOUT_DARTS, fallback.dartsPerTarget),
        failureStep: readInteger(sourceRecord, "failureStep", fallback.failureStep, 1, 25),
        successStep: readInteger(sourceRecord, "successStep", fallback.successStep, 1, 25),
      };
    case "shanghai":
      return {
        mode: "shanghai",
        players,
        matchFormat,
        rounds: fallback.rounds,
        instantShanghaiWin: readBoolean(sourceRecord, "instantShanghaiWin", fallback.instantShanghaiWin),
      };
    case "training":
      return {
        mode: "training",
        players,
        matchFormat,
        focus: readOneOf(sourceRecord, "focus", TRAINING_FOCUSES, fallback.focus),
        targets: fallback.targets,
        rounds: readOptionalInteger(sourceRecord, "rounds", fallback.rounds, 1, 20),
        maxTurns: fallback.maxTurns,
        hitsRequiredToAdvance: readOneOf(sourceRecord, "hitsRequiredToAdvance", HITS_REQUIRED_TO_ADVANCE, fallback.hitsRequiredToAdvance ?? 1),
      };
    case "killer":
      return {
        mode: "killer",
        players,
        matchFormat,
        startingLives: readInteger(sourceRecord, "startingLives", fallback.startingLives, 1, 20),
        assignment: readOneOf(sourceRecord, "assignment", KILLER_ASSIGNMENTS, fallback.assignment),
        requiredHitsToBecomeKiller: readInteger(sourceRecord, "requiredHitsToBecomeKiller", fallback.requiredHitsToBecomeKiller, 1, 5),
        allowSharedNumbers: readBoolean(sourceRecord, "allowSharedNumbers", fallback.allowSharedNumbers ?? false),
      };
  }
}

function parseConfigs(
  source: Record<string, unknown> | undefined,
  defaults: Record<GameMode, GameConfig>,
): Record<GameMode, GameConfig> {
  return {
    x01: parseConfig(source?.x01, defaults.x01),
    cricket: parseConfig(source?.cricket, defaults.cricket),
    "around-the-clock": parseConfig(source?.["around-the-clock"], defaults["around-the-clock"]),
    "bobs-27": parseConfig(source?.["bobs-27"], defaults["bobs-27"]),
    "checkout-121": parseConfig(source?.["checkout-121"], defaults["checkout-121"]),
    shanghai: parseConfig(source?.shanghai, defaults.shanghai),
    training: parseConfig(source?.training, defaults.training),
    killer: parseConfig(source?.killer, defaults.killer),
  };
}

export function readSetupPreferences(defaultConfigs: Record<GameMode, GameConfig>): SetupPreferences | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const storedValue = storage.getItem(SETUP_PREFERENCES_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(storedValue);

    if (!isRecord(parsed) || parsed.version !== SETUP_PREFERENCES_VERSION || !isGameMode(parsed.selectedMode)) {
      return null;
    }

    return {
      selectedMode: parsed.selectedMode,
      configs: parseConfigs(isRecord(parsed.configs) ? parsed.configs : undefined, defaultConfigs),
    };
  } catch {
    return null;
  }
}

export function writeSetupPreferences(preferences: SetupPreferences): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  const storedPreferences: StoredSetupPreferences = {
    version: SETUP_PREFERENCES_VERSION,
    selectedMode: preferences.selectedMode,
    configs: serializeConfigs(preferences.configs),
  };

  try {
    storage.setItem(SETUP_PREFERENCES_STORAGE_KEY, JSON.stringify(storedPreferences));
  } catch {
    // Ignore storage failures so setup remains usable in private or quota-limited contexts.
  }
}
