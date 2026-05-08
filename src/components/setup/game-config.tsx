"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { modeMessageKeys } from "./mode-selector";

import type {
  CricketTarget,
  CricketVariant,
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

const X01_START_SCORES = [301, 501, 701] as const satisfies readonly X01StartScore[];
const NUMBER_SEGMENTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const satisfies readonly NumberSegment[];
const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const satisfies readonly CricketTarget[];
const BOBS_27_ROUNDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
] as const satisfies readonly (NumberSegment | 25)[];
const CHECKOUT_DARTS = [3, 6, 9] as const;
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

const trainingFocusMessageKeys = {
  scoring: "focusScoring",
  singles: "focusSingles",
  doubles: "focusDoubles",
  checkout: "focusCheckout",
  cricket: "focusCricket",
  custom: "focusCustom",
} as const satisfies Record<TrainingFocus, string>;

const killerAssignmentMessageKeys = {
  manual: "assignmentManual",
  "first-hit": "assignmentFirstHit",
  random: "assignmentRandom",
  sequential: "assignmentSequential",
} as const satisfies Record<KillerAssignment, string>;

type GameConfigFormProps = Readonly<{
  config: GameConfig;
  onConfigChange: (config: GameConfig) => void;
}>;

type FieldProps = Readonly<{
  id: string;
  label: string;
  children: React.ReactNode;
  description?: string;
}>;

function defaultMatchFormat(): MatchFormat {
  return { legsToWin: 1, setsToWin: 1 };
}

export function createDefaultGameConfigs(): Record<GameMode, GameConfig> {
  const players: PlayerDef[] = [];

  return {
    x01: {
      mode: "x01",
      players,
      matchFormat: defaultMatchFormat(),
      startingScore: 501,
      doubleIn: false,
      doubleOut: true,
      masterOut: false,
    },
    cricket: {
      mode: "cricket",
      players,
      matchFormat: defaultMatchFormat(),
      variant: "standard",
      targets: CRICKET_TARGETS,
      scorePoints: true,
    },
    "around-the-clock": {
      mode: "around-the-clock",
      players,
      matchFormat: defaultMatchFormat(),
      startSegment: 1,
      endSegment: 20,
      requiredMultiplier: "open",
      includeBull: true,
    },
    "bobs-27": {
      mode: "bobs-27",
      players,
      matchFormat: defaultMatchFormat(),
      startingScore: 27,
      doublesOnly: true,
      rounds: BOBS_27_ROUNDS,
      allowNegativeScore: false,
    },
    "checkout-121": {
      mode: "checkout-121",
      players,
      matchFormat: defaultMatchFormat(),
      startingTarget: 121,
      minimumTarget: 2,
      maximumTarget: 170,
      dartsPerTarget: 3,
      failureStep: 1,
      successStep: 1,
    },
    shanghai: {
      mode: "shanghai",
      players,
      matchFormat: defaultMatchFormat(),
      rounds: NUMBER_SEGMENTS,
      instantShanghaiWin: true,
    },
    training: {
      mode: "training",
      players,
      matchFormat: defaultMatchFormat(),
      focus: "singles",
      rounds: 1,
      hitsRequiredToAdvance: 1,
    },
    killer: {
      mode: "killer",
      players,
      matchFormat: defaultMatchFormat(),
      startingLives: 3,
      assignment: "sequential",
      requiredHitsToBecomeKiller: 1,
      allowSharedNumbers: false,
    },
  };
}

export function buildConfigWithPlayers(
  config: GameConfig,
  players: readonly PlayerDef[],
): GameConfig {
  const startingPlayerId = players[0]?.id;

  switch (config.mode) {
    case "x01":
      return { ...config, players, startingPlayerId };
    case "cricket":
      return { ...config, players, startingPlayerId };
    case "around-the-clock":
      return { ...config, players, startingPlayerId };
    case "bobs-27":
      return { ...config, players, startingPlayerId };
    case "checkout-121":
      return { ...config, players, startingPlayerId };
    case "shanghai":
      return { ...config, players, startingPlayerId };
    case "training":
      return { ...config, players, startingPlayerId };
    case "killer":
      return { ...config, players, startingPlayerId };
  }
}

function ConfigField({ id, label, description, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function parsePositiveInteger(value: string, fallback: number, min = 1, max = 999): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function toNumberSegment(value: string, fallback: NumberSegment): NumberSegment {
  const parsed = Number.parseInt(value, 10);

  return NUMBER_SEGMENTS.includes(parsed as NumberSegment) ? (parsed as NumberSegment) : fallback;
}

function toX01StartScore(value: string, fallback: X01StartScore): X01StartScore {
  const parsed = Number.parseInt(value, 10);

  return X01_START_SCORES.includes(parsed as X01StartScore) ? (parsed as X01StartScore) : fallback;
}

function toCricketVariant(value: string, fallback: CricketVariant): CricketVariant {
  if (value === "standard" || value === "cut-throat" || value === "no-score") {
    return value;
  }

  return fallback;
}

function toTrainingFocus(value: string, fallback: TrainingFocus): TrainingFocus {
  return TRAINING_FOCUSES.includes(value as TrainingFocus) ? (value as TrainingFocus) : fallback;
}

function toKillerAssignment(value: string, fallback: KillerAssignment): KillerAssignment {
  return KILLER_ASSIGNMENTS.includes(value as KillerAssignment) ? (value as KillerAssignment) : fallback;
}

function toRequiredMultiplier(
  value: string,
  fallback: Multiplier | "open",
): Multiplier | "open" {
  if (value === "open") {
    return "open";
  }

  const parsed = Number.parseInt(value, 10);

  if (parsed === 1 || parsed === 2 || parsed === 3) {
    return parsed;
  }

  return fallback;
}

function boolValue(value: boolean | undefined): string {
  return value ? "true" : "false";
}

function BooleanSelect({
  id,
  testId,
  value,
  onValueChange,
}: Readonly<{
  id: string;
  testId: string;
  value: boolean | undefined;
  onValueChange: (value: boolean) => void;
}>) {
  const misc = useTranslations("Misc");

  return (
    <Select value={boolValue(value)} onValueChange={(nextValue) => onValueChange(nextValue === "true")}>
      <SelectTrigger id={id} data-testid={testId} className="min-h-12 w-full bg-background/65">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="true">{misc("yes")}</SelectItem>
        <SelectItem value="false">{misc("no")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function withLegsToWin<TConfig extends GameConfig>(
  config: TConfig,
  legsToWin: number,
): TConfig {
  return {
    ...config,
    matchFormat: {
      ...config.matchFormat,
      legsToWin,
    },
  };
}

function withSetsToWin<TConfig extends GameConfig>(
  config: TConfig,
  setsToWin: number,
): TConfig {
  return {
    ...config,
    matchFormat: {
      legsToWin: config.matchFormat?.legsToWin ?? 1,
      ...config.matchFormat,
      setsToWin,
    },
  };
}

export function GameConfigForm({ config, onConfigChange }: GameConfigFormProps) {
  const setup = useTranslations("Setup");
  const gameConfig = useTranslations("GameConfig");
  const modes = useTranslations("Modes");
  const modeLabel = modes(modeMessageKeys[config.mode]);
  const legsToWin = config.matchFormat?.legsToWin ?? 1;
  const setsToWin = config.matchFormat?.setsToWin ?? 1;

  return (
    <section className="space-y-5" aria-labelledby="game-config-title">
      <div className="space-y-2">
        <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.18em] text-primary">
          <SlidersHorizontal className="size-3" aria-hidden="true" />
          {setup("configStepKicker")}
        </Badge>
        <div className="space-y-2">
          <h2 id="game-config-title" className="text-2xl font-black tracking-tight sm:text-3xl">
            {setup("configStepTitle")}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {setup("configStepDescription", { mode: modeLabel })}
          </p>
        </div>
      </div>

      <Card className="border-primary/20 bg-card/95 shadow-xl shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {setup("modeConfigTitle")}
            <Badge>{modeLabel}</Badge>
          </CardTitle>
          <CardDescription>{setup("modeConfigDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <ConfigField id="config-legsToWin" label={gameConfig("legsToWin")}>
              <Input
                id="config-legsToWin"
                data-testid="config-legsToWin"
                type="number"
                min={1}
                value={legsToWin}
                className="min-h-12 bg-background/65"
                onChange={(event) => {
                  onConfigChange(
                    withLegsToWin(
                      config,
                      parsePositiveInteger(event.target.value, legsToWin, 1, 99),
                    ),
                  );
                }}
              />
            </ConfigField>
            <ConfigField id="config-setsToWin" label={gameConfig("setsToWin")}>
              <Input
                id="config-setsToWin"
                data-testid="config-setsToWin"
                type="number"
                min={1}
                value={setsToWin}
                className="min-h-12 bg-background/65"
                onChange={(event) => {
                  onConfigChange(
                    withSetsToWin(
                      config,
                      parsePositiveInteger(event.target.value, setsToWin, 1, 25),
                    ),
                  );
                }}
              />
            </ConfigField>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            {config.mode === "x01" ? (
              <>
                <ConfigField id="config-startingScore" label={gameConfig("startScore")}>
                  <Select
                    value={String(config.startingScore)}
                    onValueChange={(value) => onConfigChange({ ...config, startingScore: toX01StartScore(value, config.startingScore) })}
                  >
                    <SelectTrigger id="config-startingScore" data-testid="config-startingScore" className="min-h-12 w-full bg-background/65">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {X01_START_SCORES.map((score) => (
                        <SelectItem key={score} value={String(score)}>{score}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ConfigField>
                <ConfigField id="config-doubleIn" label={gameConfig("doubleIn")}>
                  <BooleanSelect id="config-doubleIn" testId="config-doubleIn" value={config.doubleIn} onValueChange={(value) => onConfigChange({ ...config, doubleIn: value })} />
                </ConfigField>
                <ConfigField id="config-doubleOut" label={gameConfig("doubleOut")}>
                  <BooleanSelect id="config-doubleOut" testId="config-doubleOut" value={config.doubleOut} onValueChange={(value) => onConfigChange({ ...config, doubleOut: value })} />
                </ConfigField>
                <ConfigField id="config-masterOut" label={gameConfig("masterOut")}>
                  <BooleanSelect id="config-masterOut" testId="config-masterOut" value={config.masterOut} onValueChange={(value) => onConfigChange({ ...config, masterOut: value })} />
                </ConfigField>
              </>
            ) : null}

            {config.mode === "cricket" ? (
              <>
                <ConfigField id="config-variant" label={gameConfig("variant")}>
                  <Select
                    value={config.variant}
                    onValueChange={(value) => onConfigChange({ ...config, variant: toCricketVariant(value, config.variant) })}
                  >
                    <SelectTrigger id="config-variant" data-testid="config-variant" className="min-h-12 w-full bg-background/65">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">{gameConfig("standard")}</SelectItem>
                      <SelectItem value="cut-throat">{gameConfig("cutThroat")}</SelectItem>
                      <SelectItem value="no-score">{gameConfig("noScore")}</SelectItem>
                    </SelectContent>
                  </Select>
                </ConfigField>
                <ConfigField id="config-scorePoints" label={gameConfig("scorePoints")}>
                  <BooleanSelect id="config-scorePoints" testId="config-scorePoints" value={config.scorePoints} onValueChange={(value) => onConfigChange({ ...config, scorePoints: value })} />
                </ConfigField>
                <ConfigField id="config-pointsRequiredToWin" label={gameConfig("pointsRequiredToWin")}>
                  <Input
                    id="config-pointsRequiredToWin"
                    data-testid="config-pointsRequiredToWin"
                    type="number"
                    min={0}
                    value={config.pointsRequiredToWin ?? 0}
                    className="min-h-12 bg-background/65"
                    onChange={(event) => onConfigChange({ ...config, pointsRequiredToWin: parsePositiveInteger(event.target.value, 0, 0, 999) })}
                  />
                </ConfigField>
              </>
            ) : null}

            {config.mode === "around-the-clock" ? (
              <>
                <ConfigField id="config-startSegment" label={gameConfig("startSegment")}>
                  <Select
                    value={String(config.startSegment)}
                    onValueChange={(value) => onConfigChange({ ...config, startSegment: toNumberSegment(value, config.startSegment) })}
                  >
                    <SelectTrigger id="config-startSegment" data-testid="config-startSegment" className="min-h-12 w-full bg-background/65">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NUMBER_SEGMENTS.map((segment) => (
                        <SelectItem key={segment} value={String(segment)}>{segment}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ConfigField>
                <ConfigField id="config-endSegment" label={gameConfig("endSegment")}>
                  <Select
                    value={String(config.endSegment)}
                    onValueChange={(value) => onConfigChange({ ...config, endSegment: value === "25" ? 25 : toNumberSegment(value, config.endSegment === 25 ? 20 : config.endSegment) })}
                  >
                    <SelectTrigger id="config-endSegment" data-testid="config-endSegment" className="min-h-12 w-full bg-background/65">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NUMBER_SEGMENTS.map((segment) => (
                        <SelectItem key={segment} value={String(segment)}>{segment}</SelectItem>
                      ))}
                      <SelectItem value="25">25</SelectItem>
                    </SelectContent>
                  </Select>
                </ConfigField>
                <ConfigField id="config-requiredMultiplier" label={gameConfig("requiredMultiplier")}>
                  <Select
                    value={String(config.requiredMultiplier ?? "open")}
                    onValueChange={(value) => onConfigChange({ ...config, requiredMultiplier: toRequiredMultiplier(value, config.requiredMultiplier ?? "open") })}
                  >
                    <SelectTrigger id="config-requiredMultiplier" data-testid="config-requiredMultiplier" className="min-h-12 w-full bg-background/65">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{gameConfig("open")}</SelectItem>
                      <SelectItem value="1">{gameConfig("single")}</SelectItem>
                      <SelectItem value="2">{gameConfig("double")}</SelectItem>
                      <SelectItem value="3">{gameConfig("triple")}</SelectItem>
                    </SelectContent>
                  </Select>
                </ConfigField>
                <ConfigField id="config-includeBull" label={gameConfig("includeBull")}>
                  <BooleanSelect id="config-includeBull" testId="config-includeBull" value={config.includeBull} onValueChange={(value) => onConfigChange({ ...config, includeBull: value })} />
                </ConfigField>
              </>
            ) : null}

            {config.mode === "bobs-27" ? (
              <ConfigField id="config-allowNegativeScore" label={gameConfig("allowNegativeScore")}>
                <BooleanSelect id="config-allowNegativeScore" testId="config-allowNegativeScore" value={config.allowNegativeScore} onValueChange={(value) => onConfigChange({ ...config, allowNegativeScore: value })} />
              </ConfigField>
            ) : null}

            {config.mode === "checkout-121" ? (
              <>
                <ConfigField id="config-dartsPerTarget" label={gameConfig("dartsPerTarget")}>
                  <Select
                    value={String(config.dartsPerTarget)}
                    onValueChange={(value) => {
                      const parsed = Number.parseInt(value, 10);
                      onConfigChange({ ...config, dartsPerTarget: CHECKOUT_DARTS.includes(parsed as 3 | 6 | 9) ? (parsed as 3 | 6 | 9) : config.dartsPerTarget });
                    }}
                  >
                    <SelectTrigger id="config-dartsPerTarget" data-testid="config-dartsPerTarget" className="min-h-12 w-full bg-background/65">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHECKOUT_DARTS.map((count) => (
                        <SelectItem key={count} value={String(count)}>{count}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ConfigField>
                <ConfigField id="config-successStep" label={gameConfig("successStep")}>
                  <Input
                    id="config-successStep"
                    data-testid="config-successStep"
                    type="number"
                    min={1}
                    value={config.successStep}
                    className="min-h-12 bg-background/65"
                    onChange={(event) => onConfigChange({ ...config, successStep: parsePositiveInteger(event.target.value, config.successStep, 1, 25) })}
                  />
                </ConfigField>
                <ConfigField id="config-failureStep" label={gameConfig("failureStep")}>
                  <Input
                    id="config-failureStep"
                    data-testid="config-failureStep"
                    type="number"
                    min={1}
                    value={config.failureStep}
                    className="min-h-12 bg-background/65"
                    onChange={(event) => onConfigChange({ ...config, failureStep: parsePositiveInteger(event.target.value, config.failureStep, 1, 25) })}
                  />
                </ConfigField>
              </>
            ) : null}

            {config.mode === "shanghai" ? (
              <ConfigField id="config-instantShanghaiWin" label={gameConfig("instantShanghaiWin")}>
                <BooleanSelect id="config-instantShanghaiWin" testId="config-instantShanghaiWin" value={config.instantShanghaiWin} onValueChange={(value) => onConfigChange({ ...config, instantShanghaiWin: value })} />
              </ConfigField>
            ) : null}

            {config.mode === "training" ? (
              <>
                <ConfigField id="config-trainingFocus" label={gameConfig("trainingFocus")}>
                  <Select
                    value={config.focus}
                    onValueChange={(value) => onConfigChange({ ...config, focus: toTrainingFocus(value, config.focus) })}
                  >
                    <SelectTrigger id="config-trainingFocus" data-testid="config-trainingFocus" className="min-h-12 w-full bg-background/65">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRAINING_FOCUSES.map((focus) => (
                        <SelectItem key={focus} value={focus}>{gameConfig(trainingFocusMessageKeys[focus])}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ConfigField>
                <ConfigField id="config-rounds" label={gameConfig("rounds")}>
                  <Input
                    id="config-rounds"
                    data-testid="config-rounds"
                    type="number"
                    min={1}
                    value={config.rounds ?? 1}
                    className="min-h-12 bg-background/65"
                    onChange={(event) => onConfigChange({ ...config, rounds: parsePositiveInteger(event.target.value, config.rounds ?? 1, 1, 20) })}
                  />
                </ConfigField>
                <ConfigField id="config-hitsRequiredToAdvance" label={gameConfig("hitsRequiredToAdvance")}>
                  <Select
                    value={String(config.hitsRequiredToAdvance ?? 1)}
                    onValueChange={(value) => {
                      const parsed = Number.parseInt(value, 10);
                      onConfigChange({ ...config, hitsRequiredToAdvance: parsed === 1 || parsed === 2 || parsed === 3 ? parsed : 1 });
                    }}
                  >
                    <SelectTrigger id="config-hitsRequiredToAdvance" data-testid="config-hitsRequiredToAdvance" className="min-h-12 w-full bg-background/65">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </ConfigField>
              </>
            ) : null}

            {config.mode === "killer" ? (
              <>
                <ConfigField id="config-startingLives" label={gameConfig("startingLives")}>
                  <Input
                    id="config-startingLives"
                    data-testid="config-startingLives"
                    type="number"
                    min={1}
                    value={config.startingLives}
                    className="min-h-12 bg-background/65"
                    onChange={(event) => onConfigChange({ ...config, startingLives: parsePositiveInteger(event.target.value, config.startingLives, 1, 20) })}
                  />
                </ConfigField>
                <ConfigField id="config-assignment" label={gameConfig("assignment")}>
                  <Select
                    value={config.assignment}
                    onValueChange={(value) => onConfigChange({ ...config, assignment: toKillerAssignment(value, config.assignment) })}
                  >
                    <SelectTrigger id="config-assignment" data-testid="config-assignment" className="min-h-12 w-full bg-background/65">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KILLER_ASSIGNMENTS.map((assignment) => (
                        <SelectItem key={assignment} value={assignment}>{gameConfig(killerAssignmentMessageKeys[assignment])}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ConfigField>
                <ConfigField id="config-requiredHitsToBecomeKiller" label={gameConfig("requiredHitsToBecomeKiller")}>
                  <Input
                    id="config-requiredHitsToBecomeKiller"
                    data-testid="config-requiredHitsToBecomeKiller"
                    type="number"
                    min={1}
                    value={config.requiredHitsToBecomeKiller}
                    className="min-h-12 bg-background/65"
                    onChange={(event) => onConfigChange({ ...config, requiredHitsToBecomeKiller: parsePositiveInteger(event.target.value, config.requiredHitsToBecomeKiller, 1, 5) })}
                  />
                </ConfigField>
                <ConfigField id="config-allowSharedNumbers" label={gameConfig("allowSharedNumbers")}>
                  <BooleanSelect id="config-allowSharedNumbers" testId="config-allowSharedNumbers" value={config.allowSharedNumbers} onValueChange={(value) => onConfigChange({ ...config, allowSharedNumbers: value })} />
                </ConfigField>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
