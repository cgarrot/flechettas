"use client";

import { CheckCircle2, Circle, Info, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

import { modeMessageKeys } from "./game-presets";

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

const compactInputClassName = "h-9 min-h-0 bg-background/65 px-2 py-1 text-sm";
const compactSelectTriggerClassName = "h-9 min-h-0 w-full bg-background/65 px-2 py-1 text-sm data-[size=default]:min-h-9 data-[size=sm]:min-h-9";

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
      doubleOut: false,
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <div className="relative space-y-1">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <label htmlFor={id} className="min-w-0 truncate text-xs font-semibold">
          {label}
        </label>
        {description ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 rounded-full text-primary hover:bg-primary/10"
            aria-label={description}
            aria-expanded={isHelpOpen}
            onClick={() => setIsHelpOpen((current) => !current)}
          >
            <Info className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {children}
      {description && isHelpOpen ? (
        <p className="absolute right-0 z-20 mt-1 max-w-[min(20rem,calc(100vw-3rem))] rounded-xl border border-primary/25 bg-popover px-3 py-2 text-[0.68rem] leading-4 text-popover-foreground shadow-xl shadow-primary/10">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function ToggleGroup<TValue extends string>({
  id,
  label,
  value,
  options,
  onValueChange,
  testId,
  columns = 2,
}: Readonly<{
  id: string;
  label: string;
  value: TValue;
  options: readonly Readonly<{ value: TValue; label: string }>[];
  onValueChange: (value: TValue) => void;
  testId: string;
  columns?: 2 | 3 | 4;
}>) {
  const columnClass = columns === 4 ? "grid-cols-2 sm:grid-cols-4" : columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div id={id} className={`grid ${columnClass} gap-1 rounded-lg border border-border/70 bg-background/65 p-1`} role="radiogroup" aria-label={label} data-testid={testId}>
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <Button
            key={option.value}
            type="button"
            variant={isSelected ? "default" : "ghost"}
            size="sm"
            className="min-h-9 rounded-md px-1.5 text-[0.68rem] font-bold"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
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

function BooleanSelect({
  id,
  label,
  testId,
  value,
  onValueChange,
}: Readonly<{
  id: string;
  label: string;
  testId: string;
  value: boolean | undefined;
  onValueChange: (value: boolean) => void;
}>) {
  const misc = useTranslations("Misc");
  const isPressed = value === true;
  const stateLabel = misc(isPressed ? "yes" : "no");

  return (
    <Button
      id={id}
      type="button"
      variant={isPressed ? "default" : "outline"}
      size="sm"
      className="min-h-9 w-full justify-start rounded-lg px-2 text-[0.68rem] font-bold"
      data-testid={testId}
      aria-pressed={isPressed}
      aria-label={`${label}: ${stateLabel}`}
      onClick={() => onValueChange(!isPressed)}
    >
      {isPressed ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Circle className="size-4" aria-hidden="true" />}
      {stateLabel}
    </Button>
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
    <section className="space-y-3" aria-labelledby="game-config-title">
      <div className="space-y-1">
        <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.18em] text-primary">
          <SlidersHorizontal className="size-3" aria-hidden="true" />
          {setup("configStepKicker")}
        </Badge>
        <div className="space-y-1">
          <h2 id="game-config-title" className="text-lg font-black tracking-tight sm:text-xl">
            {setup("configStepTitle")}
          </h2>
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
            {setup("configStepDescription", { mode: modeLabel })}
          </p>
        </div>
      </div>

      <Card className="border-primary/20 bg-card/95 py-0 shadow-xl shadow-primary/5">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            {setup("modeConfigTitle")}
            <Badge>{modeLabel}</Badge>
          </CardTitle>
          <CardDescription className="text-xs">{setup("modeConfigDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0">
          <div className="grid grid-cols-2 gap-2">
            <ConfigField id="config-legsToWin" label={gameConfig("legsToWin")} description={gameConfig("help.legsToWin")}>
              <Input
                id="config-legsToWin"
                data-testid="config-legsToWin"
                type="number"
                min={1}
                value={legsToWin}
                className={compactInputClassName}
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
            <ConfigField id="config-setsToWin" label={gameConfig("setsToWin")} description={gameConfig("help.setsToWin")}>
              <Input
                id="config-setsToWin"
                data-testid="config-setsToWin"
                type="number"
                min={1}
                value={setsToWin}
                className={compactInputClassName}
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

          <div className="grid grid-cols-2 gap-2">
            {config.mode === "x01" ? (
              <>
                <ConfigField id="config-startingScore" label={gameConfig("startScore")} description={gameConfig("help.startScore")}>
                  <ToggleGroup
                    id="config-startingScore"
                    label={gameConfig("startScore")}
                    value={String(config.startingScore)}
                    options={X01_START_SCORES.map((score) => ({ value: String(score), label: String(score) }))}
                    onValueChange={(value) => onConfigChange({ ...config, startingScore: toX01StartScore(value, config.startingScore) })}
                    testId="config-startingScore"
                    columns={3}
                  />
                </ConfigField>
                <ConfigField id="config-doubleIn" label={gameConfig("doubleIn")} description={gameConfig("help.doubleIn")}>
                  <BooleanSelect id="config-doubleIn" label={gameConfig("doubleIn")} testId="config-doubleIn" value={config.doubleIn} onValueChange={(value) => onConfigChange({ ...config, doubleIn: value })} />
                </ConfigField>
                <ConfigField id="config-doubleOut" label={gameConfig("doubleOut")} description={gameConfig("help.doubleOut")}>
                  <BooleanSelect id="config-doubleOut" label={gameConfig("doubleOut")} testId="config-doubleOut" value={config.doubleOut} onValueChange={(value) => onConfigChange({ ...config, doubleOut: value })} />
                </ConfigField>
                <ConfigField id="config-masterOut" label={gameConfig("masterOut")} description={gameConfig("help.masterOut")}>
                  <BooleanSelect id="config-masterOut" label={gameConfig("masterOut")} testId="config-masterOut" value={config.masterOut} onValueChange={(value) => onConfigChange({ ...config, masterOut: value })} />
                </ConfigField>
              </>
            ) : null}

            {config.mode === "cricket" ? (
              <>
                <ConfigField id="config-variant" label={gameConfig("variant")} description={gameConfig("help.variant")}>
                  <ToggleGroup
                    id="config-variant"
                    label={gameConfig("variant")}
                    value={config.variant}
                    options={[
                      { value: "standard", label: gameConfig("standard") },
                      { value: "cut-throat", label: gameConfig("cutThroat") },
                      { value: "no-score", label: gameConfig("noScore") },
                    ]}
                    onValueChange={(value) => onConfigChange({ ...config, variant: toCricketVariant(value, config.variant) })}
                    testId="config-variant"
                    columns={3}
                  />
                </ConfigField>
                <ConfigField id="config-scorePoints" label={gameConfig("scorePoints")} description={gameConfig("help.scorePoints")}>
                  <BooleanSelect id="config-scorePoints" label={gameConfig("scorePoints")} testId="config-scorePoints" value={config.scorePoints} onValueChange={(value) => onConfigChange({ ...config, scorePoints: value })} />
                </ConfigField>
                <ConfigField id="config-pointsRequiredToWin" label={gameConfig("pointsRequiredToWin")} description={gameConfig("help.pointsRequiredToWin")}>
                  <Input
                    id="config-pointsRequiredToWin"
                    data-testid="config-pointsRequiredToWin"
                    type="number"
                    min={0}
                    value={config.pointsRequiredToWin ?? 0}
                    className={compactInputClassName}
                    onChange={(event) => onConfigChange({ ...config, pointsRequiredToWin: parsePositiveInteger(event.target.value, 0, 0, 999) })}
                  />
                </ConfigField>
              </>
            ) : null}

            {config.mode === "around-the-clock" ? (
              <>
                <ConfigField id="config-startSegment" label={gameConfig("startSegment")} description={gameConfig("help.startSegment")}>
                  <Select
                    value={String(config.startSegment)}
                    onValueChange={(value) => onConfigChange({ ...config, startSegment: toNumberSegment(value, config.startSegment) })}
                  >
                    <SelectTrigger id="config-startSegment" data-testid="config-startSegment" className={compactSelectTriggerClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NUMBER_SEGMENTS.map((segment) => (
                        <SelectItem key={segment} value={String(segment)}>{segment}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ConfigField>
                <ConfigField id="config-endSegment" label={gameConfig("endSegment")} description={gameConfig("help.endSegment")}>
                  <Select
                    value={String(config.endSegment)}
                    onValueChange={(value) => onConfigChange({ ...config, endSegment: value === "25" ? 25 : toNumberSegment(value, config.endSegment === 25 ? 20 : config.endSegment) })}
                  >
                    <SelectTrigger id="config-endSegment" data-testid="config-endSegment" className={compactSelectTriggerClassName}>
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
                <ConfigField id="config-requiredMultiplier" label={gameConfig("requiredMultiplier")} description={gameConfig("help.requiredMultiplier")}>
                  <ToggleGroup
                    id="config-requiredMultiplier"
                    label={gameConfig("requiredMultiplier")}
                    value={String(config.requiredMultiplier ?? "open")}
                    options={[
                      { value: "open", label: gameConfig("open") },
                      { value: "1", label: gameConfig("single") },
                      { value: "2", label: gameConfig("double") },
                      { value: "3", label: gameConfig("triple") },
                    ]}
                    onValueChange={(value) => onConfigChange({ ...config, requiredMultiplier: toRequiredMultiplier(value, config.requiredMultiplier ?? "open") })}
                    testId="config-requiredMultiplier"
                    columns={4}
                  />
                </ConfigField>
                <ConfigField id="config-includeBull" label={gameConfig("includeBull")} description={gameConfig("help.includeBull")}>
                  <BooleanSelect id="config-includeBull" label={gameConfig("includeBull")} testId="config-includeBull" value={config.includeBull} onValueChange={(value) => onConfigChange({ ...config, includeBull: value })} />
                </ConfigField>
              </>
            ) : null}

            {config.mode === "bobs-27" ? (
              <ConfigField id="config-allowNegativeScore" label={gameConfig("allowNegativeScore")} description={gameConfig("help.allowNegativeScore")}>
                <BooleanSelect id="config-allowNegativeScore" label={gameConfig("allowNegativeScore")} testId="config-allowNegativeScore" value={config.allowNegativeScore} onValueChange={(value) => onConfigChange({ ...config, allowNegativeScore: value })} />
              </ConfigField>
            ) : null}

            {config.mode === "checkout-121" ? (
              <>
                <ConfigField id="config-dartsPerTarget" label={gameConfig("dartsPerTarget")} description={gameConfig("help.dartsPerTarget")}>
                  <ToggleGroup
                    id="config-dartsPerTarget"
                    label={gameConfig("dartsPerTarget")}
                    value={String(config.dartsPerTarget)}
                    options={CHECKOUT_DARTS.map((count) => ({ value: String(count), label: String(count) }))}
                    onValueChange={(value) => {
                      const parsed = Number.parseInt(value, 10);
                      onConfigChange({ ...config, dartsPerTarget: CHECKOUT_DARTS.includes(parsed as 3 | 6 | 9) ? (parsed as 3 | 6 | 9) : config.dartsPerTarget });
                    }}
                    testId="config-dartsPerTarget"
                    columns={3}
                  />
                </ConfigField>
                <ConfigField id="config-successStep" label={gameConfig("successStep")} description={gameConfig("help.successStep")}>
                  <Input
                    id="config-successStep"
                    data-testid="config-successStep"
                    type="number"
                    min={1}
                    value={config.successStep}
                    className={compactInputClassName}
                    onChange={(event) => onConfigChange({ ...config, successStep: parsePositiveInteger(event.target.value, config.successStep, 1, 25) })}
                  />
                </ConfigField>
                <ConfigField id="config-failureStep" label={gameConfig("failureStep")} description={gameConfig("help.failureStep")}>
                  <Input
                    id="config-failureStep"
                    data-testid="config-failureStep"
                    type="number"
                    min={1}
                    value={config.failureStep}
                    className={compactInputClassName}
                    onChange={(event) => onConfigChange({ ...config, failureStep: parsePositiveInteger(event.target.value, config.failureStep, 1, 25) })}
                  />
                </ConfigField>
              </>
            ) : null}

            {config.mode === "shanghai" ? (
              <ConfigField id="config-instantShanghaiWin" label={gameConfig("instantShanghaiWin")} description={gameConfig("help.instantShanghaiWin")}>
                <BooleanSelect id="config-instantShanghaiWin" label={gameConfig("instantShanghaiWin")} testId="config-instantShanghaiWin" value={config.instantShanghaiWin} onValueChange={(value) => onConfigChange({ ...config, instantShanghaiWin: value })} />
              </ConfigField>
            ) : null}

            {config.mode === "training" ? (
              <>
                <ConfigField id="config-trainingFocus" label={gameConfig("trainingFocus")} description={gameConfig("help.trainingFocus")}>
                  <ToggleGroup
                    id="config-trainingFocus"
                    label={gameConfig("trainingFocus")}
                    value={config.focus}
                    options={TRAINING_FOCUSES.map((focus) => ({ value: focus, label: gameConfig(trainingFocusMessageKeys[focus]) }))}
                    onValueChange={(value) => onConfigChange({ ...config, focus: toTrainingFocus(value, config.focus) })}
                    testId="config-trainingFocus"
                    columns={3}
                  />
                </ConfigField>
                <ConfigField id="config-rounds" label={gameConfig("rounds")} description={gameConfig("help.rounds")}>
                  <Input
                    id="config-rounds"
                    data-testid="config-rounds"
                    type="number"
                    min={1}
                    value={config.rounds ?? 1}
                    className={compactInputClassName}
                    onChange={(event) => onConfigChange({ ...config, rounds: parsePositiveInteger(event.target.value, config.rounds ?? 1, 1, 20) })}
                  />
                </ConfigField>
                <ConfigField id="config-hitsRequiredToAdvance" label={gameConfig("hitsRequiredToAdvance")} description={gameConfig("help.hitsRequiredToAdvance")}>
                  <ToggleGroup
                    id="config-hitsRequiredToAdvance"
                    label={gameConfig("hitsRequiredToAdvance")}
                    value={String(config.hitsRequiredToAdvance ?? 1)}
                    options={["1", "2", "3"].map((count) => ({ value: count, label: count }))}
                    onValueChange={(value) => {
                      const parsed = Number.parseInt(value, 10);
                      onConfigChange({ ...config, hitsRequiredToAdvance: parsed === 1 || parsed === 2 || parsed === 3 ? parsed : 1 });
                    }}
                    testId="config-hitsRequiredToAdvance"
                    columns={3}
                  />
                </ConfigField>
              </>
            ) : null}

            {config.mode === "killer" ? (
              <>
                <ConfigField id="config-startingLives" label={gameConfig("startingLives")} description={gameConfig("help.startingLives")}>
                  <Input
                    id="config-startingLives"
                    data-testid="config-startingLives"
                    type="number"
                    min={1}
                    value={config.startingLives}
                    className={compactInputClassName}
                    onChange={(event) => onConfigChange({ ...config, startingLives: parsePositiveInteger(event.target.value, config.startingLives, 1, 20) })}
                  />
                </ConfigField>
                <ConfigField id="config-assignment" label={gameConfig("assignment")} description={gameConfig("help.assignment")}>
                  <ToggleGroup
                    id="config-assignment"
                    label={gameConfig("assignment")}
                    value={config.assignment}
                    options={KILLER_ASSIGNMENTS.map((assignment) => ({ value: assignment, label: gameConfig(killerAssignmentMessageKeys[assignment]) }))}
                    onValueChange={(value) => onConfigChange({ ...config, assignment: toKillerAssignment(value, config.assignment) })}
                    testId="config-assignment"
                    columns={4}
                  />
                </ConfigField>
                <ConfigField id="config-requiredHitsToBecomeKiller" label={gameConfig("requiredHitsToBecomeKiller")} description={gameConfig("help.requiredHitsToBecomeKiller")}>
                  <Input
                    id="config-requiredHitsToBecomeKiller"
                    data-testid="config-requiredHitsToBecomeKiller"
                    type="number"
                    min={1}
                    value={config.requiredHitsToBecomeKiller}
                    className={compactInputClassName}
                    onChange={(event) => onConfigChange({ ...config, requiredHitsToBecomeKiller: parsePositiveInteger(event.target.value, config.requiredHitsToBecomeKiller, 1, 5) })}
                  />
                </ConfigField>
                <ConfigField id="config-allowSharedNumbers" label={gameConfig("allowSharedNumbers")} description={gameConfig("help.allowSharedNumbers")}>
                  <BooleanSelect id="config-allowSharedNumbers" label={gameConfig("allowSharedNumbers")} testId="config-allowSharedNumbers" value={config.allowSharedNumbers} onValueChange={(value) => onConfigChange({ ...config, allowSharedNumbers: value })} />
                </ConfigField>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
